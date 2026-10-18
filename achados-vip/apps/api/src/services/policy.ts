/**
 * Política de publicação: TODAS as travas, avaliadas antes de enfileirar e de enviar.
 *
 * Travas "duras" (nunca contornadas, nem com force): oferta aprovada, produto não suspenso, link de afiliado
 * VALIDADO, canal habilitado/autenticado, duplicidade, preço ainda válido.
 * Travas de "ritmo" (podem ser ignoradas com force pelo administrador): republicação, horário de silêncio,
 * intervalo mínimo e limites por hora/dia/categoria.
 *
 * Contadores de ritmo são POR CANAL e vêm do banco: SENT (sentAt) e MANUAL_READY (scheduledFor = momento em que
 * foi liberada à fila) contam como "liberadas". Assim a fila manual NÃO consome o limite dos canais automáticos
 * (cada canal tem seu próprio ritmo), mas respeita o mesmo ritmo no próprio canal. Na hora de ENFILEIRAR, as
 * publicações já reservadas (PENDING/SCHEDULED/SENDING/FAILED) também contam, o que limita o tamanho da fila.
 */
import type { Category, Offer, OfferStatus, Prisma, Product, PublicationStatus, PublishingChannel, Publication } from '@prisma/client';
import { getConfiguredSource } from '../adapters/index.js';
import { decidePublishWindow, decideRepublish, startOfLocalDay } from '../domain/antispam.js';
import { calcDiscountPct } from '../domain/pricing.js';
import type { Settings } from '../domain/settings.js';
import type { MessageFormat, MessageInput, NormalizedListing, OfferKindName, OfferSource } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { PublishBlockedError, type PublishBlockCode } from '../lib/errors.js';
import { cleanError } from '../adapters/publishers/common.js';
import { HOUR_MS } from '../lib/time.js';
import { getValidatedLink } from './affiliate.js';
import { formatMessage } from './message-formatter.js';
import { getSettings } from './settings.js';

export const OFFER_INCLUDE = { product: { include: { category: true } } } as const satisfies Prisma.OfferInclude;
export type OfferWithProduct = Prisma.OfferGetPayload<{ include: typeof OFFER_INCLUDE }>;

/** Subida de preço tolerada entre a descoberta e o envio (acima disso a oferta expira). */
export const PRICE_RISE_TOLERANCE_PCT = 2;

/** Estados de oferta que permitem publicar (PUBLISHED: já saiu em outro canal e pode sair neste). */
export const PUBLISHABLE_OFFER_STATUSES: readonly OfferStatus[] = ['APPROVED', 'QUEUED', 'PUBLISHED'];
/** Publicações "em andamento" (ocupam o produto no canal). */
export const ACTIVE_PUBLICATION_STATUSES: readonly PublicationStatus[] = ['PENDING', 'SCHEDULED', 'SENDING', 'FAILED', 'MANUAL_READY'];
const RESERVED_STATUSES: readonly PublicationStatus[] = ['PENDING', 'SCHEDULED', 'SENDING', 'FAILED'];

export interface PolicyBlock {
  code: PublishBlockCode;
  message?: string;
  details?: unknown;
}

export const toBlockedError = (b: PolicyBlock): PublishBlockedError => new PublishBlockedError(b.code, b.message, b.details);

// ---------- travas da oferta e do produto ----------

export function checkOffer(offer: Pick<Offer, 'status' | 'expiresAt'>, now: Date): PolicyBlock | null {
  if (offer.status === 'EXPIRED' || (offer.expiresAt !== null && offer.expiresAt.getTime() <= now.getTime())) {
    return { code: 'STALE_PRICE', message: 'Publicação bloqueada: a oferta expirou (preço ou disponibilidade mudou).' };
  }
  if (!PUBLISHABLE_OFFER_STATUSES.includes(offer.status)) {
    return { code: 'OFFER_NOT_APPROVED', message: `Publicação bloqueada: a oferta está "${offer.status}" (só ofertas aprovadas podem ser publicadas).` };
  }
  return null;
}

export function checkProduct(product: Pick<Product, 'status' | 'suspendedUntil' | 'suspendReason'>, now: Date): PolicyBlock | null {
  const suspendedByDate = product.suspendedUntil !== null && product.suspendedUntil.getTime() > now.getTime();
  if (product.status !== 'ACTIVE' || suspendedByDate) {
    const why = product.suspendReason ? ` (${product.suspendReason})` : '';
    return {
      code: 'SUSPENDED_PRODUCT',
      message: `Publicação bloqueada: o produto está ${product.status === 'ACTIVE' ? 'suspenso' : product.status.toLowerCase()}${why}.`,
      details: { suspendedUntil: product.suspendedUntil?.toISOString() ?? null },
    };
  }
  return null;
}

/**
 * Link de afiliado VALIDADO do produto (regra inegociável nº 1). Reusa AffiliateLinkService.getValidatedLink, que
 * confere status VALIDATED, host/formato atuais e recusa fonte "fixture" em produção. Nunca devolve PENDING/INVALID.
 */
export async function findValidatedLink(productId: string): Promise<{ id: string; url: string } | null> {
  const link = await getValidatedLink(productId);
  return link ? { id: link.id, url: link.url } : null;
}

export const NO_LINK_BLOCK: PolicyBlock = { code: 'NO_VALIDATED_LINK' };

// ---------- travas do canal ----------

export function checkChannel(channel: Pick<PublishingChannel, 'enabled' | 'status' | 'name'>): PolicyBlock | null {
  if (!channel.enabled) return { code: 'CHANNEL_DISABLED', message: `Publicação bloqueada: o canal "${channel.name}" está desabilitado.` };
  if (channel.status === 'AUTH_REQUIRED') {
    return { code: 'CHANNEL_DISABLED', message: `Publicação bloqueada: o canal "${channel.name}" está pausado (autenticação necessária).` };
  }
  return null;
}

// ---------- duplicidade e republicação ----------

export const idempotencyKey = (offerId: string, channelId: string): string => `${offerId}:${channelId}`;

/** Publicação existente para (oferta, canal) — a chave de idempotência é única. */
export function findByKey(offerId: string, channelId: string): Promise<Publication | null> {
  return prisma.publication.findUnique({ where: { idempotencyKey: idempotencyKey(offerId, channelId) } });
}

/** Outra oferta da mesma família (mesmo produto/catálogo) ainda em andamento no canal. */
export async function checkFamilyInFlight(offer: OfferWithProduct, channelId: string): Promise<PolicyBlock | null> {
  const other = await prisma.publication.findFirst({
    where: {
      channelId,
      status: { in: [...ACTIVE_PUBLICATION_STATUSES] },
      offerId: { not: offer.id },
      offer: { product: { familyKey: offer.product.familyKey } },
    },
    select: { id: true, status: true },
  });
  return other ? { code: 'DUPLICATE', message: 'Publicação bloqueada: o mesmo produto já está na fila deste canal.', details: { publicationId: other.id, status: other.status } } : null;
}

/** Regra de republicação (domínio puro) sobre a última publicação CONFIRMADA da família neste canal. */
export async function checkRepublish(offer: OfferWithProduct, channelId: string, now: Date, settings: Settings): Promise<PolicyBlock | null> {
  const last = await prisma.publication.findFirst({
    where: { channelId, status: 'SENT', sentAt: { not: null }, offerId: { not: offer.id }, offer: { product: { familyKey: offer.product.familyKey } } },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true, offer: { select: { priceCents: true } } },
  });
  if (!last) return null;
  const d = decideRepublish(
    { lastPublishedAt: last.sentAt, lastPublishedPriceCents: last.offer.priceCents, currentPriceCents: offer.priceCents, now },
    settings,
  );
  return d.allowed ? null : { code: 'DUPLICATE', message: `Publicação bloqueada: ${d.reason}.`, details: { reason: d.reason } };
}

// ---------- janela, intervalo e limites (contadores reais do banco) ----------

function releasedWhere(channelId: string, since: Date | null, categoryId?: string | null): Prisma.PublicationWhereInput {
  return {
    channelId,
    ...(categoryId ? { offer: { product: { categoryId } } } : {}),
    OR: [
      { status: 'SENT', ...(since ? { sentAt: { gte: since } } : {}) },
      { status: 'MANUAL_READY', ...(since ? { scheduledFor: { gte: since } } : {}) },
    ],
  };
}

export interface ChannelCounters {
  lastPublishedAt: Date | null;
  publishedLastHour: number;
  publishedToday: number;
  publishedTodayInCategory: number;
}

export async function channelCounters(
  channelId: string,
  categoryId: string | null,
  now: Date,
  settings: Settings,
  opts: { includeReserved: boolean },
): Promise<ChannelCounters> {
  let dayStart: Date;
  try {
    dayStart = startOfLocalDay(now, settings.publishing.quietHours.timezone);
  } catch {
    dayStart = new Date(now.getTime() - 24 * HOUR_MS); // fuso inválido: o domínio já falha fechado em quiet hours
  }
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const [lastSent, lastManual, hour, day, inCat, reserved, reservedInCat] = await Promise.all([
    prisma.publication.aggregate({ where: { channelId, status: 'SENT' }, _max: { sentAt: true } }),
    prisma.publication.aggregate({ where: { channelId, status: 'MANUAL_READY' }, _max: { scheduledFor: true } }),
    prisma.publication.count({ where: releasedWhere(channelId, hourAgo) }),
    prisma.publication.count({ where: releasedWhere(channelId, dayStart) }),
    categoryId ? prisma.publication.count({ where: releasedWhere(channelId, dayStart, categoryId) }) : Promise.resolve(0),
    opts.includeReserved ? prisma.publication.count({ where: { channelId, status: { in: [...RESERVED_STATUSES] } } }) : Promise.resolve(0),
    opts.includeReserved && categoryId
      ? prisma.publication.count({ where: { channelId, status: { in: [...RESERVED_STATUSES] }, offer: { product: { categoryId } } } })
      : Promise.resolve(0),
  ]);
  const times = [lastSent._max.sentAt, lastManual._max.scheduledFor].filter((d): d is Date => d !== null);
  return {
    lastPublishedAt: times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null,
    publishedLastHour: hour + reserved,
    publishedToday: day + reserved,
    publishedTodayInCategory: inCat + reservedInCat,
  };
}

export async function checkWindow(
  channelId: string,
  category: Pick<Category, 'id' | 'dailyLimit'> | null,
  now: Date,
  settings: Settings,
  opts: { includeReserved: boolean },
): Promise<PolicyBlock | null> {
  const c = await channelCounters(channelId, category?.id ?? null, now, settings, opts);
  const d = decidePublishWindow({
    now,
    settings,
    // na hora de enfileirar o intervalo mínimo é aplicado no ENVIO (as reservas ainda não saíram)
    lastPublishedAt: c.lastPublishedAt,
    publishedLastHour: c.publishedLastHour,
    publishedToday: c.publishedToday,
    publishedTodayInCategory: c.publishedTodayInCategory,
    categoryDailyLimit: category?.dailyLimit ?? null,
  });
  if (d.allowed) return null;
  return {
    code: d.code ?? 'OUT_OF_WINDOW',
    message: `Publicação bloqueada: ${d.reason ?? 'fora da janela permitida'}.`,
    details: { reason: d.reason, nextAllowedAt: d.nextAllowedAt?.toISOString() ?? null },
  };
}

// ---------- revalidação de preço ----------

export type PriceCheck =
  | { status: 'skipped'; reason: string }
  | { status: 'ok'; priceCents: number; listing: NormalizedListing }
  | { status: 'stale'; reason: string; priceCents: number }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

let sourceProvider: (() => Promise<OfferSource | null>) | null = null;
/** Injeta a fonte usada na revalidação (testes). `null` restaura o padrão. */
export function setOfferSourceProvider(fn: (() => Promise<OfferSource | null>) | null): void {
  sourceProvider = fn;
}

/** Fonte configurada em settings.monitoring.source (null se não for possível criá-la). */
export async function resolveOfferSource(): Promise<OfferSource | null> {
  if (sourceProvider) return sourceProvider();
  try {
    return await getConfiguredSource(await getSettings());
  } catch {
    return null;
  }
}

/**
 * Revalida preço/estoque na fonte. Sem fonte disponível => "skipped" (publica com o preço descoberto).
 * Preço subiu mais que a tolerância, anúncio indisponível/sem estoque => oferta deve expirar.
 * Erro de consulta (rede, 429, auth) => "error": quem chama ADIA o envio, não expira a oferta.
 */
export async function revalidatePrice(offer: Pick<Offer, 'priceCents'>, product: Pick<Product, 'externalId'>, source: OfferSource | null): Promise<PriceCheck> {
  if (!source) return { status: 'skipped', reason: 'fonte indisponível para revalidação' };
  let listing: NormalizedListing | null;
  try {
    listing = await source.fetchListing(product.externalId);
  } catch (err) {
    return { status: 'error', reason: cleanError(err) };
  }
  if (!listing) return { status: 'unavailable', reason: 'anúncio indisponível na fonte' };
  if (listing.availableQuantity !== null && listing.availableQuantity !== undefined && listing.availableQuantity <= 0) {
    return { status: 'unavailable', reason: 'sem estoque' };
  }
  if (!Number.isInteger(listing.priceCents) || listing.priceCents <= 0) return { status: 'error', reason: 'preço inválido retornado pela fonte' };
  if (listing.priceCents * 100 > offer.priceCents * (100 + PRICE_RISE_TOLERANCE_PCT)) {
    return { status: 'stale', priceCents: listing.priceCents, reason: `preço subiu de ${offer.priceCents} para ${listing.priceCents} centavos (> ${PRICE_RISE_TOLERANCE_PCT}%)` };
  }
  return { status: 'ok', priceCents: listing.priceCents, listing };
}

// ---------- mensagem (somente dados verificados + link validado) ----------

/** ML serve miniaturas em http://…mlstatic.com; o host também responde em https. */
export function pickImageUrl(product: Pick<Product, 'imageUrl' | 'thumbnail'>): string | null {
  const raw = product.imageUrl ?? product.thumbnail ?? null;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' && u.hostname.endsWith('mlstatic.com')) u.protocol = 'https:';
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function parseInstallments(json: Prisma.JsonValue | null): MessageInput['installments'] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const { quantity, amountCents, interestFree } = json as Record<string, unknown>;
  if (typeof quantity !== 'number' || typeof amountCents !== 'number' || typeof interestFree !== 'boolean') return null;
  return { quantity, amountCents, interestFree };
}

export interface ComposeArgs {
  offer: Pick<Offer, 'kind' | 'priceCents' | 'originalPriceCents' | 'discountVerified' | 'couponCode' | 'couponDiscountCents' | 'installments'>;
  product: Pick<Product, 'title'>;
  affiliateUrl: string;
  settings: Settings;
  format: MessageFormat;
  /** Preço revalidado (substitui o da descoberta). */
  priceCents?: number;
  soldQuantity?: number | null;
}

/**
 * Monta a mensagem final. "De/Por" e % só quando o desconto é VERIFICADO e coerente com o preço atual;
 * parcelamento só se a fonte informou e a configuração permitir; cupom só o que veio da fonte.
 * Lança Error (formatMessage) se o link for inválido: nunca publica sem link de afiliado.
 */
export function composeMessage(a: ComposeArgs): string {
  const price = a.priceCents ?? a.offer.priceCents;
  const verifiedOriginal = a.offer.discountVerified && a.offer.originalPriceCents ? a.offer.originalPriceCents : null;
  const discountPct = verifiedOriginal ? calcDiscountPct(verifiedOriginal, price) : null;
  const input: MessageInput = {
    title: a.product.title,
    priceCents: price,
    originalPriceCents: discountPct !== null ? verifiedOriginal : null,
    discountPct,
    installments: a.settings.messages.showInstallments ? parseInstallments(a.offer.installments) : null,
    couponCode: a.offer.couponCode,
    couponDiscountCents: a.offer.couponDiscountCents,
    affiliateUrl: a.affiliateUrl,
    kind: a.offer.kind as OfferKindName,
    disclosure: a.settings.messages.disclosure,
    soldQuantity: a.soldQuantity ?? null,
  };
  return formatMessage(input, a.format);
}
