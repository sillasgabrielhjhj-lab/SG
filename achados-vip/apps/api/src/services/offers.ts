/**
 * Ofertas para o painel: listagem/detalhe (DTOs do contrato), aprovar, rejeitar e publicar.
 * "Publicar" delega ao PublishingService (outro módulo, carregado dinamicamente): é ele quem aplica as regras
 * inegociáveis (link validado, janela, limites, idempotência). Aqui nunca se envia nada.
 */
import type { OfferKind, OfferStatus, OfferTier, Prisma, Publication, PublicationStatus, ChannelType } from '@prisma/client';
import { formatMessage } from './message-formatter.js';
import type { MessageInput, ScoreResult } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { AppError, ConflictError, NotFoundError } from '../lib/errors.js';
import { pageParams, pageResult, type Page } from '../lib/pagination.js';
import { addDays } from '../lib/time.js';
import { getValidatedLink, productsWithValidatedLink, toAffiliateLinkDTO, type AffiliateLinkDTO } from './affiliate.js';
import { recordAudit } from './audit.js';
import { getSettings } from './settings.js';

// ---------- DTOs ----------

export interface OfferDTO {
  id: string;
  status: OfferStatus;
  tier: OfferTier;
  kind: OfferKind;
  score: number;
  scoreBreakdown: ScoreResult['breakdown'] | null;
  priceCents: number;
  originalPriceCents: number | null;
  discountPct: number | null;
  savingsCents: number | null;
  discountVerified: boolean;
  couponCode: string | null;
  discoveredAt: string;
  hasValidatedLink: boolean;
  product: {
    id: string;
    title: string;
    thumbnail: string | null;
    permalink: string;
    sellerName: string | null;
    category: { id: string; name: string } | null;
  };
}

export interface PublicationDTO {
  id: string;
  offerId: string;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  status: PublicationStatus;
  template: OfferKind;
  messageText: string;
  imageUrl: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  attemptsCount: number;
  lastError: string | null;
  createdAt: string;
  productTitle: string;
}

export interface OfferDetailDTO extends OfferDTO {
  priceHistory: { priceCents: number; originalPriceCents: number | null; observedAt: string; source: string }[];
  affiliateLinks: AffiliateLinkDTO[];
  publications: PublicationDTO[];
  messagePreview: { whatsapp: string; telegram: string } | null;
}

const offerInclude = { product: { include: { category: { select: { id: true, name: true } } } } } satisfies Prisma.OfferInclude;
type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toOfferDTO(o: OfferRow, hasLink: boolean): OfferDTO {
  return {
    id: o.id,
    status: o.status,
    tier: o.tier,
    kind: o.kind,
    score: o.score,
    scoreBreakdown: (o.scoreBreakdown as ScoreResult['breakdown'] | null) ?? null,
    priceCents: o.priceCents,
    originalPriceCents: o.discountVerified ? o.originalPriceCents : null, // nunca expõe preço "de" não verificado
    discountPct: o.discountVerified ? o.discountPct : null,
    savingsCents: o.discountVerified ? o.savingsCents : null,
    discountVerified: o.discountVerified,
    couponCode: o.couponCode,
    discoveredAt: o.discoveredAt.toISOString(),
    hasValidatedLink: hasLink,
    product: {
      id: o.product.id,
      title: o.product.title,
      thumbnail: o.product.thumbnail,
      permalink: o.product.permalink,
      sellerName: o.product.sellerName,
      category: o.product.category,
    },
  };
}

type PublicationRow = Publication & { channel: { name: string; type: ChannelType }; offer: { product: { title: string } } };
export const publicationInclude = { channel: { select: { name: true, type: true } }, offer: { select: { product: { select: { title: true } } } } } satisfies Prisma.PublicationInclude;

export const toPublicationDTO = (p: PublicationRow): PublicationDTO => ({
  id: p.id,
  offerId: p.offerId,
  channelId: p.channelId,
  channelName: p.channel.name,
  channelType: p.channel.type,
  status: p.status,
  template: p.template,
  messageText: p.messageText,
  imageUrl: p.imageUrl,
  scheduledFor: iso(p.scheduledFor),
  sentAt: iso(p.sentAt),
  attemptsCount: p.attemptsCount,
  lastError: p.lastError,
  createdAt: p.createdAt.toISOString(),
  productTitle: p.offer.product.title,
});

// ---------- listagem ----------

export interface OfferListQuery {
  status?: OfferStatus[];
  categoryId?: string;
  minScore?: number;
  q?: string;
  sort: 'score' | 'discoveredAt' | 'discountPct';
  page: number;
  pageSize: number;
}

const ORDER: Record<OfferListQuery['sort'], Prisma.OfferOrderByWithRelationInput[]> = {
  score: [{ score: 'desc' }, { discoveredAt: 'desc' }, { id: 'desc' }],
  discoveredAt: [{ discoveredAt: 'desc' }, { id: 'desc' }],
  discountPct: [{ discountPct: { sort: 'desc', nulls: 'last' } }, { score: 'desc' }, { id: 'desc' }],
};

export async function listOffers(q: OfferListQuery): Promise<Page<OfferDTO>> {
  const where: Prisma.OfferWhereInput = {
    ...(q.status?.length ? { status: { in: q.status } } : {}),
    ...(q.minScore !== undefined ? { score: { gte: q.minScore } } : {}),
    product: {
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    },
  };
  const [rows, total] = await Promise.all([
    prisma.offer.findMany({ where, include: offerInclude, orderBy: ORDER[q.sort], ...pageParams(q) }),
    prisma.offer.count({ where }),
  ]);
  const withLink = await productsWithValidatedLink(rows.map((r) => r.productId));
  return pageResult(
    rows.map((r) => toOfferDTO(r, withLink.has(r.productId))),
    total,
    q,
  );
}

export async function getOfferDTO(id: string): Promise<OfferDTO> {
  const row = await prisma.offer.findUnique({ where: { id }, include: offerInclude });
  if (!row) throw new NotFoundError('Oferta não encontrada.');
  return toOfferDTO(row, (await productsWithValidatedLink([row.productId])).has(row.productId));
}

function asInstallments(json: unknown): MessageInput['installments'] {
  if (typeof json !== 'object' || json === null) return null;
  const j = json as Record<string, unknown>;
  return typeof j.quantity === 'number' && typeof j.amountCents === 'number' && typeof j.interestFree === 'boolean'
    ? { quantity: j.quantity, amountCents: j.amountCents, interestFree: j.interestFree }
    : null;
}

export async function getOfferDetail(id: string): Promise<OfferDetailDTO> {
  const row = await prisma.offer.findUnique({ where: { id }, include: offerInclude });
  if (!row) throw new NotFoundError('Oferta não encontrada.');
  const settings = await getSettings();
  const [history, links, publications, validated, observation] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { productId: row.productId, observedAt: { gte: addDays(new Date(), -180) } },
      orderBy: { observedAt: 'desc' },
      take: 500,
      select: { priceCents: true, originalPriceCents: true, observedAt: true, source: true },
    }),
    prisma.affiliateLink.findMany({ where: { productId: row.productId }, orderBy: { createdAt: 'desc' }, include: { product: { select: { title: true } } } }),
    prisma.publication.findMany({ where: { offerId: id }, orderBy: { createdAt: 'desc' }, include: publicationInclude }),
    getValidatedLink(row.productId),
    row.priceHistoryId ? prisma.priceHistory.findUnique({ where: { id: row.priceHistoryId }, select: { soldQuantity: true } }) : null,
  ]);

  let messagePreview: OfferDetailDTO['messagePreview'] = null;
  if (validated) {
    const input: MessageInput = {
      title: row.product.title,
      priceCents: row.priceCents,
      // preço "de" e % só com referência verificada (regra inegociável)
      originalPriceCents: row.discountVerified ? row.originalPriceCents : null,
      discountPct: row.discountVerified ? row.discountPct : null,
      installments: settings.messages.showInstallments ? asInstallments(row.installments) : null,
      couponCode: row.couponCode,
      couponDiscountCents: row.couponDiscountCents,
      affiliateUrl: validated.url,
      kind: row.kind,
      disclosure: settings.messages.disclosure,
      soldQuantity: observation?.soldQuantity ?? null,
    };
    try {
      messagePreview = { whatsapp: formatMessage(input, 'whatsapp'), telegram: formatMessage(input, 'telegram_html') };
    } catch {
      messagePreview = null; // dados insuficientes para uma mensagem honesta
    }
  }

  return {
    ...toOfferDTO(row, validated !== null),
    priceHistory: history
      .reverse()
      .map((h) => ({ priceCents: h.priceCents, originalPriceCents: h.originalPriceCents, observedAt: h.observedAt.toISOString(), source: h.source })),
    affiliateLinks: links.map(toAffiliateLinkDTO),
    publications: publications.map(toPublicationDTO),
    messagePreview,
  };
}

// ---------- decisões ----------

const PRODUCT_NOT_ACTIVE = 'O produto está suspenso ou indisponível; a oferta não pode ser aprovada.';

async function decide(
  id: string,
  by: string,
  note: string | undefined,
  rule: { from: OfferStatus[]; to: OfferStatus; action: string; verb: string },
): Promise<OfferDTO> {
  const offer = await prisma.offer.findUnique({ where: { id }, include: { product: { select: { status: true } } } });
  if (!offer) throw new NotFoundError('Oferta não encontrada.');
  if (offer.status === rule.to) return getOfferDTO(id); // idempotente
  if (!rule.from.includes(offer.status)) {
    throw new ConflictError(`Uma oferta com status ${offer.status} não pode ser ${rule.verb}.`, 'INVALID_STATE', { status: offer.status });
  }
  if (rule.to === 'APPROVED' && offer.product.status !== 'ACTIVE') throw new ConflictError(PRODUCT_NOT_ACTIVE, 'SUSPENDED_PRODUCT');

  const now = new Date();
  const res = await prisma.offer.updateMany({
    where: { id, status: { in: rule.from } }, // condicional: evita corrida com outra decisão/publicação
    data: { status: rule.to, decidedBy: by, decidedAt: now, decisionNote: note?.trim() || null },
  });
  if (res.count === 0) throw new ConflictError('A oferta mudou de status; recarregue e tente novamente.', 'INVALID_STATE');
  await recordAudit({ userId: by, action: rule.action, entity: 'Offer', entityId: id, before: { status: offer.status }, after: { status: rule.to, note: note ?? null } });
  return getOfferDTO(id);
}

export const approveOffer = (id: string, by: string, note?: string): Promise<OfferDTO> =>
  decide(id, by, note, { from: ['DISCOVERED', 'REJECTED'], to: 'APPROVED', action: 'offer.approve', verb: 'aprovada' });

export const rejectOffer = (id: string, by: string, note?: string): Promise<OfferDTO> =>
  decide(id, by, note, { from: ['DISCOVERED', 'APPROVED'], to: 'REJECTED', action: 'offer.reject', verb: 'rejeitada' });

// ---------- publicar (delegado) ----------

export interface PublishingApi {
  enqueueOffer(offerId: string, opts?: { channelId?: string; force?: boolean; by?: string }): Promise<{ id: string }[]>;
}

const PUBLISHING_MODULE = './publishing.js';
const defaultPublishingLoader = async (): Promise<PublishingApi> => {
  try {
    // especificador em variável: este arquivo compila mesmo se o módulo de publicação ainda não existir
    return (await import(PUBLISHING_MODULE)) as PublishingApi;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module|Failed to load url|Failed to resolve import/i.test(e?.message ?? '')) {
      throw new AppError(501, 'PUBLISHING_UNAVAILABLE', 'O módulo de publicação não está disponível nesta instalação.');
    }
    throw err;
  }
};
let publishingLoader: () => Promise<PublishingApi> = defaultPublishingLoader;

/** SOMENTE TESTES: substitui o carregamento do PublishingService. */
export function setPublishingLoaderForTests(loader: (() => Promise<PublishingApi>) | null): void {
  publishingLoader = loader ?? defaultPublishingLoader;
}

export async function publishOffer(id: string, opts: { channelId?: string; by: string }): Promise<{ offer: OfferDTO; publications: PublicationDTO[] }> {
  const exists = await prisma.offer.count({ where: { id } });
  if (!exists) throw new NotFoundError('Oferta não encontrada.');
  const publishing = await publishingLoader();
  // PublishBlockedError (409 + code) sobe como está
  const created = await publishing.enqueueOffer(id, { ...(opts.channelId ? { channelId: opts.channelId } : {}), by: opts.by });
  const rows = await prisma.publication.findMany({ where: { id: { in: created.map((p) => p.id) } }, include: publicationInclude, orderBy: { createdAt: 'asc' } });
  return { offer: await getOfferDTO(id), publications: rows.map(toPublicationDTO) };
}

