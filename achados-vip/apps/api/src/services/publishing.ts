/**
 * Serviço de publicação (PublishingService).
 *
 * Fluxo: enqueueOffer (travas + cria Publication) -> processDue (tick: ordena por score, respeita ritmo) ->
 * sendPublication (lock otimista, revalida preço, monta a mensagem, envia, registra a tentativa).
 *
 * Decisões:
 * - SENT somente com SendResult.confirmed === true. Canal manual => MANUAL_READY; só markManualSent gera SENT.
 * - Idempotência: idempotencyKey "<offerId>:<channelId>" (única) + lock PENDING|SCHEDULED|FAILED -> SENDING via
 *   updateMany condicional. Duas chamadas concorrentes de sendPublication => um único envio.
 * - Ritmo (silêncio, intervalo, limites) é POR CANAL. A fila manual não consome o limite dos canais automáticos,
 *   mas segue o mesmo ritmo no próprio canal (MANUAL_READY conta como liberada) — ver policy.ts.
 * - Fila manual é alimentada automaticamente mesmo com autoPublish desligado (ela não envia nada sozinha);
 *   canais automáticos só recebem ofertas do piloto automático com autoPublish ligado e score >= minScoreToPublish.
 * - force (administrador) ignora apenas o ritmo e a regra de republicação; link validado, oferta aprovada, produto
 *   ativo, canal habilitado, duplicidade e preço válido nunca são contornados.
 * - Backoff de reenvio: 1min, 5min, 15min, 1h, 4h, 12h; ao atingir settings.publishing.maxAttempts => DEAD
 *   (+ notificação + fila "dead-letter"). Erro permanente => DEAD direto. authRequired => canal AUTH_REQUIRED,
 *   alerta e pausa SEM consumir tentativa.
 * - Risco residual (comum a todo envio "pelo menos uma vez"): se o processo cair depois de o provedor aceitar a
 *   mensagem e antes de gravar SENT, a recuperação reenvia (pode duplicar uma vez). Webhooks deduplicam por idempotencyKey.
 */
import type { Prisma, Publication, PublicationStatus, PublishingChannel } from '@prisma/client';
import { AdapterConfigError, channelFormat, createPublisher, isAutomaticChannel, type CredentialValues } from '../adapters/index.js';
import { cleanError, redactKnownSecrets, transportFailure } from '../adapters/publishers/common.js';
import { CHANNEL_CREDENTIAL_PROVIDER } from '../adapters/publishers/config.js';
import { calcSavingsCents, calcDiscountPct } from '../domain/pricing.js';
import type { Settings } from '../domain/settings.js';
import type { OfferSource, PublisherAdapter, SendResult } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { ConflictError, NotFoundError, PublishBlockedError } from '../lib/errors.js';
import { sanitizeForLog } from '../lib/logger.js';
import { pageParams, pageResult, type Page } from '../lib/pagination.js';
import { HOUR_MS, MINUTE_MS, addMs, sleep, withTimeout } from '../lib/time.js';
import { addToDeadLetter, enqueueSendJob } from '../queues/queues.js';
import { recordAudit } from './audit.js';
import { publicationInclude, toPublicationDTO, type PublicationDTO } from './offers.js';
import { loadCredentialValues } from './channels.js';
import { logEvent } from './logs.js';
import { notify } from './notifications.js';
import {
  ACTIVE_PUBLICATION_STATUSES,
  OFFER_INCLUDE,
  checkChannel,
  checkFamilyInFlight,
  checkOffer,
  checkProduct,
  checkRepublish,
  checkWindow,
  composeMessage,
  findByKey,
  findValidatedLink,
  idempotencyKey,
  pickImageUrl,
  resolveOfferSource,
  revalidatePrice,
  toBlockedError,
  type OfferWithProduct,
  type PolicyBlock,
  type PriceCheck,
} from './policy.js';
import { getSettings } from './settings.js';

// ---------- constantes ----------

/** Esperas entre reenvios (índice = nº da tentativa que falhou - 1; a última repete). */
export const BACKOFF_MS = [1 * MINUTE_MS, 5 * MINUTE_MS, 15 * MINUTE_MS, 1 * HOUR_MS, 4 * HOUR_MS, 12 * HOUR_MS] as const;
export function backoffMs(attemptsMade: number): number {
  return BACKOFF_MS[Math.min(Math.max(attemptsMade, 1), BACKOFF_MS.length) - 1] as number;
}

const SENDABLE: PublicationStatus[] = ['PENDING', 'SCHEDULED', 'FAILED'];
/** Prazo máximo de uma chamada de envio (os adaptadores têm prazo próprio menor). */
const SEND_DEADLINE_MS = 30_000;
/** Ofertas mais velhas que isto não entram na alimentação automática. */
export const AUTO_FEED_MAX_AGE_HOURS = 24;
const AUTO_FEED_CANDIDATES = 20;
/** Itens da fila manual mais velhos que isto expiram (o preço pode ter mudado). */
export const MANUAL_QUEUE_MAX_AGE_HOURS = 24;
const HOLD_LINK_MS = 10 * MINUTE_MS;
const HOLD_SOURCE_MS = 5 * MINUTE_MS;

export interface SendDeps {
  now?: Date;
  /** Fonte usada para revalidar o preço. `null` = não revalidar. Padrão: fonte configurada nas settings. */
  source?: OfferSource | null;
  /** Substitui a criação do adaptador (testes). */
  createAdapter?: (channel: PublishingChannel, credentials: CredentialValues | null) => PublisherAdapter;
}

// ---------- DTOs e consultas ----------

// DTO/include de Publication são os do módulo de ofertas (mesmo formato em /api/offers/:id e /api/publications)
export { toPublicationDTO, publicationInclude, type PublicationDTO };

export interface AttemptDTO {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  response: unknown;
}

export async function getPublicationDTO(id: string): Promise<PublicationDTO> {
  const row = await prisma.publication.findUnique({ where: { id }, include: publicationInclude });
  if (!row) throw new NotFoundError('Publicação não encontrada.');
  return toPublicationDTO(row);
}

export async function getPublicationDetail(id: string): Promise<PublicationDTO & { attempts: AttemptDTO[] }> {
  const row = await prisma.publication.findUnique({
    where: { id },
    include: { ...publicationInclude, attempts: { orderBy: { startedAt: 'asc' } } },
  });
  if (!row) throw new NotFoundError('Publicação não encontrada.');
  return {
    ...toPublicationDTO(row),
    attempts: row.attempts.map((a) => ({
      id: a.id,
      startedAt: a.startedAt.toISOString(),
      finishedAt: a.finishedAt?.toISOString() ?? null,
      success: a.success,
      httpStatus: a.httpStatus,
      error: a.error,
      response: a.response,
    })),
  };
}

export async function listPublications(q: { status?: PublicationStatus; channelId?: string; page: number; pageSize: number }): Promise<Page<PublicationDTO>> {
  const where: Prisma.PublicationWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.channelId ? { channelId: q.channelId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.publication.findMany({ where, include: publicationInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...pageParams(q) }),
    prisma.publication.count({ where }),
  ]);
  return pageResult(rows.map(toPublicationDTO), total, q);
}

/** Fila manual: MANUAL_READY, melhores ofertas primeiro. */
export async function listManualQueue(): Promise<PublicationDTO[]> {
  const rows = await prisma.publication.findMany({
    where: { status: 'MANUAL_READY' },
    include: publicationInclude,
    orderBy: [{ offer: { score: 'desc' } }, { createdAt: 'asc' }],
    take: 200,
  });
  return rows.map(toPublicationDTO);
}

// ---------- estado da oferta ----------

/** Recalcula o status da oferta a partir de suas publicações (APPROVED <-> QUEUED <-> PUBLISHED). */
export async function settleOfferStatus(offerId: string): Promise<void> {
  const [sent, active] = await Promise.all([
    prisma.publication.count({ where: { offerId, status: 'SENT' } }),
    prisma.publication.count({ where: { offerId, status: { in: [...ACTIVE_PUBLICATION_STATUSES] } } }),
  ]);
  if (sent > 0) await prisma.offer.updateMany({ where: { id: offerId, status: { in: ['APPROVED', 'QUEUED'] } }, data: { status: 'PUBLISHED' } });
  else if (active > 0) await prisma.offer.updateMany({ where: { id: offerId, status: 'APPROVED' }, data: { status: 'QUEUED' } });
  else await prisma.offer.updateMany({ where: { id: offerId, status: 'QUEUED' }, data: { status: 'APPROVED' } });
}

/** Oferta perdeu a validade (preço subiu, indisponível): expira e cancela o que ainda não saiu. */
async function expireOffer(offerId: string, reason: string, alsoCancelId: string): Promise<void> {
  const msg = `Oferta expirada: ${reason}`.slice(0, 500);
  await prisma.$transaction([
    prisma.offer.update({ where: { id: offerId }, data: { status: 'EXPIRED', decisionNote: msg } }),
    prisma.publication.updateMany({
      where: { offerId, OR: [{ status: { in: ['PENDING', 'SCHEDULED', 'FAILED', 'MANUAL_READY'] } }, { id: alsoCancelId }] },
      data: { status: 'CANCELLED', lockedAt: null, lastError: msg },
    }),
  ]);
  await logEvent('INFO', 'publishing', 'Oferta expirada na revalidação', { offerId, reason });
}

// ---------- enfileirar ----------

export interface EnqueueOptions {
  /** Só este canal; sem isso, todos os canais habilitados. */
  channelId?: string;
  /** Ignora o RITMO e a regra de republicação (decisão do administrador). Nunca ignora link/aprovação/duplicidade. */
  force?: boolean;
  /** Usuário (ou "auto") que originou o pedido. */
  by?: string;
  /** Publica a partir deste horário (status SCHEDULED). */
  scheduledFor?: Date;
}

/**
 * Cria a(s) Publication da oferta. Lança PublishBlockedError (409) com o código da trava.
 * Sem channelId, cria nos canais permitidos e só lança se NENHUM puder receber a oferta.
 */
export async function enqueueOffer(offerId: string, opts: EnqueueOptions = {}, deps: Pick<SendDeps, 'now' | 'source'> = {}): Promise<Publication[]> {
  const now = deps.now ?? new Date();
  const settings = await getSettings();
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: OFFER_INCLUDE });
  if (!offer) throw new NotFoundError('Oferta não encontrada.');

  // travas da oferta (valem para qualquer canal)
  const offerBlock = checkOffer(offer, now) ?? checkProduct(offer.product, now);
  if (offerBlock) throw toBlockedError(offerBlock);
  const link = await findValidatedLink(offer.productId);
  if (!link) throw new PublishBlockedError('NO_VALIDATED_LINK');

  let channels: PublishingChannel[];
  if (opts.channelId) {
    const ch = await prisma.publishingChannel.findUnique({ where: { id: opts.channelId } });
    if (!ch) throw new NotFoundError('Canal não encontrado.');
    channels = [ch];
  } else {
    channels = await prisma.publishingChannel.findMany({ where: { enabled: true }, orderBy: { createdAt: 'asc' } });
  }
  if (channels.length === 0) throw new PublishBlockedError('CHANNEL_DISABLED', 'Publicação bloqueada: nenhum canal habilitado.');

  // travas por canal
  interface Eligible {
    channel: PublishingChannel;
    revive: Publication | null;
  }
  const eligible: Eligible[] = [];
  let firstBlock: PolicyBlock | null = null;
  for (const channel of channels) {
    const block = await evaluateChannel(offer, channel, now, settings, opts.force === true);
    if ('block' in block) {
      if (opts.channelId) throw toBlockedError(block.block);
      firstBlock ??= block.block;
      continue;
    }
    eligible.push({ channel, revive: block.revive });
  }
  if (eligible.length === 0) throw toBlockedError(firstBlock ?? { code: 'CHANNEL_DISABLED' });

  // preço ainda válido? (uma consulta para todos os canais)
  const source = deps.source !== undefined ? deps.source : await resolveOfferSource();
  const price = await revalidatePrice(offer, offer.product, source);
  if (price.status === 'stale' || price.status === 'unavailable') {
    await prisma.offer.update({ where: { id: offer.id }, data: { status: 'EXPIRED', decisionNote: `Oferta expirada: ${price.reason}` } });
    throw new PublishBlockedError('STALE_PRICE', `Publicação bloqueada: ${price.reason}. A oferta foi expirada.`);
  }
  const priceCents = price.status === 'ok' ? price.priceCents : offer.priceCents;
  const soldQuantity = await loadSoldQuantity(offer);

  const created: Publication[] = [];
  for (const { channel, revive } of eligible) {
    const manual = !isAutomaticChannel(channel.type);
    const text = composeMessage({ offer, product: offer.product, affiliateUrl: link.url, settings, format: channelFormat(channel.type), priceCents, soldQuantity });
    const scheduled = opts.scheduledFor && opts.scheduledFor.getTime() > now.getTime() ? opts.scheduledFor : null;
    const status: PublicationStatus = manual ? 'MANUAL_READY' : scheduled ? 'SCHEDULED' : 'PENDING';
    const data = {
      status,
      template: offer.kind,
      messageText: text,
      imageUrl: pickImageUrl(offer.product),
      affiliateLinkId: link.id,
      // MANUAL_READY: scheduledFor = momento em que foi liberada à fila (base dos contadores de ritmo)
      scheduledFor: manual ? now : scheduled,
    };
    try {
      const pub = revive
        ? await prisma.publication.update({ where: { id: revive.id }, data: { ...data, attemptsCount: 0, lastError: null, lockedAt: null, sentAt: null } })
        : await prisma.publication.create({ data: { ...data, offerId: offer.id, channelId: channel.id, idempotencyKey: idempotencyKey(offer.id, channel.id) } });
      created.push(pub);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new PublishBlockedError('DUPLICATE'); // corrida: outro processo criou
      throw err;
    }
  }
  await settleOfferStatus(offer.id);
  await logEvent('INFO', 'publishing', `Oferta enfileirada em ${created.length} canal(is)`, {
    offerId: offer.id,
    channels: created.map((p) => p.channelId),
    by: opts.by ?? null,
    force: opts.force === true,
  });
  return created;
}

/** Travas por canal, na ordem: canal -> duplicidade -> republicação -> ritmo. */
async function evaluateChannel(
  offer: OfferWithProduct,
  channel: PublishingChannel,
  now: Date,
  settings: Settings,
  force: boolean,
): Promise<{ block: PolicyBlock } | { revive: Publication | null }> {
  const chBlock = checkChannel(channel);
  if (chBlock) return { block: chBlock };

  const existing = await findByKey(offer.id, channel.id);
  if (existing && existing.status !== 'CANCELLED') return { block: { code: 'DUPLICATE', details: { publicationId: existing.id, status: existing.status } } };
  const family = await checkFamilyInFlight(offer, channel.id);
  if (family) return { block: family };

  if (!force) {
    const republish = await checkRepublish(offer, channel.id, now, settings);
    if (republish) return { block: republish };
    const window = await checkWindow(channel.id, offer.product.category, now, settings, { includeReserved: true });
    if (window) return { block: window };
  }
  return { revive: existing }; // CANCELLED anterior é reativada (a chave de idempotência é única)
}

async function loadSoldQuantity(offer: { kind: string; priceHistoryId: string | null }): Promise<number | null> {
  if (offer.kind !== 'POPULAR' || !offer.priceHistoryId) return null;
  const ph = await prisma.priceHistory.findUnique({ where: { id: offer.priceHistoryId }, select: { soldQuantity: true } });
  return ph?.soldQuantity ?? null;
}

// ---------- envio ----------

async function reload(id: string): Promise<Publication> {
  return prisma.publication.findUniqueOrThrow({ where: { id } });
}

/** Devolve a publicação ao estado anterior (sem consumir tentativa), opcionalmente adiando. */
async function releaseLock(id: string, prev: PublicationStatus, patch: { lastError: string; delayUntil?: Date }): Promise<void> {
  await prisma.publication.updateMany({
    where: { id, status: 'SENDING' },
    data: { status: prev, lockedAt: null, lastError: cleanError(patch.lastError, 500), ...(patch.delayUntil ? { scheduledFor: patch.delayUntil } : {}) },
  });
}

async function withRetries<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(200 * i * i);
    }
  }
}

/**
 * Envia a publicação. Idempotente: se outro processo já pegou o lock (ou ela não está mais pendente), devolve o
 * estado atual sem enviar. Lança PublishBlockedError quando uma trava dura segura o envio (publicação volta ao
 * estado anterior e fica aguardando: link ausente, produto suspenso, canal pausado, preço não revalidável).
 * Oferta rejeitada/expirada => publicação CANCELLED (retorna normalmente).
 */
export async function sendPublication(publicationId: string, deps: SendDeps = {}): Promise<Publication> {
  const now = deps.now ?? new Date();
  const current = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!current) throw new NotFoundError('Publicação não encontrada.');
  if (!SENDABLE.includes(current.status)) return current;

  // lock otimista: só um processo/chamada vence
  const lock = await prisma.publication.updateMany({
    where: { id: publicationId, status: { in: SENDABLE } },
    data: { status: 'SENDING', lockedAt: now },
  });
  if (lock.count !== 1) return reload(publicationId);

  const state = { sendStarted: false };
  try {
    return await executeLocked(publicationId, current.status, now, deps, state);
  } catch (err) {
    if (err instanceof PublishBlockedError) throw err; // trava dura: lock já foi liberado
    if (!state.sendStarted) {
      // falha inesperada ANTES de chamar o provedor: solta o lock para nova tentativa
      await releaseLock(publicationId, current.status, { lastError: `Erro interno: ${cleanError(err)}`, delayUntil: addMs(now, MINUTE_MS) }).catch(() => undefined);
    }
    // depois do envio o lock permanece: a recuperação decide (ver cabeçalho — evita reenvio imediato)
    await logEvent('ERROR', 'publishing', 'Erro inesperado ao enviar publicação', { publicationId, err });
    throw err;
  }
}

async function executeLocked(id: string, prev: PublicationStatus, now: Date, deps: SendDeps, state: { sendStarted: boolean }): Promise<Publication> {
  const pub = await prisma.publication.findUniqueOrThrow({ where: { id }, include: { channel: true, offer: { include: OFFER_INCLUDE } } });
  const { channel, offer } = pub;
  const product = offer.product;
  const settings = await getSettings();
  const hold = async (block: PolicyBlock, delayMs?: number): Promise<never> => {
    await releaseLock(id, prev, { lastError: block.message ?? block.code, ...(delayMs ? { delayUntil: addMs(now, delayMs) } : {}) });
    throw toBlockedError(block);
  };

  // 1) travas duras
  const channelBlock = checkChannel(channel);
  if (channelBlock) return hold(channelBlock);
  const offerBlock = checkOffer(offer, now);
  if (offerBlock) {
    await prisma.publication.updateMany({ where: { id, status: 'SENDING' }, data: { status: 'CANCELLED', lockedAt: null, lastError: offerBlock.message ?? offerBlock.code } });
    await settleOfferStatus(offer.id);
    return reload(id);
  }
  const productBlock = checkProduct(product, now);
  if (productBlock) return hold(productBlock, Math.max(HOLD_LINK_MS, (product.suspendedUntil?.getTime() ?? 0) - now.getTime()));
  const link = await findValidatedLink(product.id);
  if (!link) return hold({ code: 'NO_VALIDATED_LINK', message: 'Publicação bloqueada: o produto não tem link de afiliado validado (aguardando).' }, HOLD_LINK_MS);

  // 2) preço ainda válido?
  const source = deps.source !== undefined ? deps.source : await resolveOfferSource();
  const price: PriceCheck = await revalidatePrice(offer, product, source);
  if (price.status === 'stale' || price.status === 'unavailable') {
    await expireOffer(offer.id, price.reason, id);
    return reload(id);
  }
  if (price.status === 'error') {
    return hold({ code: 'STALE_PRICE', message: `Não foi possível revalidar o preço agora (${price.reason}); nova tentativa em breve.` }, HOLD_SOURCE_MS);
  }
  const priceCents = price.status === 'ok' ? price.priceCents : offer.priceCents;
  if (priceCents !== offer.priceCents) await applyRevalidatedPrice(offer, priceCents);

  // 3) mensagem (só dados verificados + link validado)
  let text: string;
  try {
    text = composeMessage({
      offer: { ...offer, priceCents },
      product,
      affiliateUrl: link.url,
      settings,
      format: channelFormat(channel.type),
      priceCents,
      soldQuantity: await loadSoldQuantity(offer),
    });
  } catch (err) {
    await failPublication(pub, `Mensagem inválida: ${cleanError(err)}`, { now, permanent: true });
    return reload(id);
  }
  const imageUrl = pickImageUrl(product);

  // 4) adaptador
  let adapter: PublisherAdapter;
  let secretValues: string[] = [];
  try {
    const provider = CHANNEL_CREDENTIAL_PROVIDER[channel.type];
    const credentials = provider ? await loadCredentialValues(channel.credentialId) : null;
    secretValues = Object.values(credentials ?? {});
    adapter = (deps.createAdapter ?? createPublisher)(channel, credentials);
  } catch (err) {
    if (!(err instanceof AdapterConfigError)) throw err;
    await pauseChannel(channel, err.kind === 'credentials' ? 'AUTH_REQUIRED' : 'ERROR', err.message);
    return hold({ code: 'CHANNEL_DISABLED', message: `Canal "${channel.name}" não pôde ser usado: ${err.message}` }, 5 * MINUTE_MS);
  }

  // 5) canal manual: só prepara a mensagem (nunca SENT)
  if (!adapter.automatic) {
    await prisma.publication.updateMany({
      where: { id, status: 'SENDING' },
      data: { status: 'MANUAL_READY', messageText: text, imageUrl, affiliateLinkId: link.id, scheduledFor: now, lockedAt: null, lastError: null },
    });
    await settleOfferStatus(offer.id);
    return reload(id);
  }

  // 6) envio + registro da tentativa
  const attempt = await prisma.publicationAttempt.create({ data: { publicationId: id } });
  await prisma.publication.update({ where: { id }, data: { messageText: text, imageUrl, affiliateLinkId: link.id } });
  state.sendStarted = true;
  let result: SendResult;
  try {
    result = await withTimeout(adapter.send({ text, imageUrl, idempotencyKey: pub.idempotencyKey }), SEND_DEADLINE_MS, 'envio');
  } catch (err) {
    result = transportFailure(err);
  }
  result = redactKnownSecrets(result, secretValues); // provedor/receptor que ecoe o segredo "pelado" não o grava em lugar nenhum
  const finishedAt = new Date();
  const attemptData = {
    finishedAt,
    success: result.ok && result.confirmed,
    httpStatus: result.httpStatus ?? null,
    error: result.error ? cleanError(result.error, 500) : null,
    ...(result.response !== undefined ? { response: sanitizeForLog(result.response) as Prisma.InputJsonValue } : {}),
  };

  if (result.ok && result.confirmed) {
    // SENT somente com confirmação do provedor
    await withRetries(() =>
      prisma.$transaction([
        prisma.publicationAttempt.update({ where: { id: attempt.id }, data: attemptData }),
        prisma.publication.updateMany({
          where: { id, status: 'SENDING' },
          data: { status: 'SENT', sentAt: finishedAt, externalMessageId: result.externalMessageId ?? null, attemptsCount: { increment: 1 }, lockedAt: null, lastError: null },
        }),
      ]),
    );
    state.sendStarted = false; // gravado: nada a preservar
    await settleOfferStatus(offer.id);
    await logEvent('INFO', 'publishing', `Publicação enviada em "${channel.name}"`, { publicationId: id, offerId: offer.id, channelId: channel.id, externalMessageId: result.externalMessageId ?? null });
    return reload(id);
  }

  await prisma.publicationAttempt.update({ where: { id: attempt.id }, data: attemptData });
  const error = result.error ?? 'Envio não confirmado pelo canal';

  if (result.authRequired) {
    // credencial inválida/sem permissão: pausa o canal, alerta e NÃO consome tentativa
    await pauseChannel(channel, 'AUTH_REQUIRED', error);
    await releaseLock(id, prev, { lastError: error });
    state.sendStarted = false;
    return reload(id);
  }
  await failPublication(pub, error, { now: finishedAt, ...(result.permanent ? { permanent: true } : {}), ...(result.retryAfterMs !== undefined ? { retryAfterMs: result.retryAfterMs } : {}) });
  state.sendStarted = false;
  return reload(id);
}

/** Canal fica AUTH_REQUIRED (credencial) ou ERROR (configuração) com alerta deduplicado; envios pausam. */
async function pauseChannel(channel: PublishingChannel, status: 'AUTH_REQUIRED' | 'ERROR', detail: string): Promise<void> {
  await prisma.publishingChannel.update({ where: { id: channel.id }, data: { status, statusDetail: cleanError(detail, 500), lastCheckedAt: new Date() } });
  await notify(
    status === 'AUTH_REQUIRED'
      ? { level: 'ERROR', type: 'integration_auth_required', title: `Canal "${channel.name}": autenticação necessária`, body: detail, dedupeKey: `channel-auth:${channel.id}` }
      : { level: 'ERROR', type: 'integration_error', title: `Canal "${channel.name}": configuração inválida`, body: detail, dedupeKey: `channel-error:${channel.id}` },
  );
  await logEvent('WARN', 'publishing', `Canal "${channel.name}" pausado: ${status}`, { channelId: channel.id, detail });
}

/** Preço revalidado diferente do descoberto: mantém a oferta coerente com o que será publicado. */
async function applyRevalidatedPrice(offer: { id: string; originalPriceCents: number | null; discountVerified: boolean }, priceCents: number): Promise<void> {
  const verified = offer.discountVerified && offer.originalPriceCents ? offer.originalPriceCents : null;
  await prisma.offer.update({
    where: { id: offer.id },
    data: { priceCents, discountPct: verified ? calcDiscountPct(verified, priceCents) : null, savingsCents: verified ? calcSavingsCents(verified, priceCents) : null },
  });
}

interface FailCtx {
  id: string;
  offerId: string;
  channelId: string;
  attemptsCount: number;
  channel: { name: string };
  offer: { product: { title: string } };
}

/**
 * Registra uma falha de envio: FAILED com backoff (1m, 5m, 15m, 1h...) ou DEAD ao atingir maxAttempts / erro permanente
 * (+ notificação + dead-letter). Só age se a publicação ainda estiver SENDING (protege contra corrida com a recuperação).
 */
export async function failPublication(pub: FailCtx, error: string, opts: { now?: Date; permanent?: boolean; retryAfterMs?: number }): Promise<'FAILED' | 'DEAD' | null> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const attempts = pub.attemptsCount + 1;
  const dead = opts.permanent === true || attempts >= settings.publishing.maxAttempts;
  const message = cleanError(error, 500);
  const wait = Math.max(backoffMs(attempts), Math.min(opts.retryAfterMs ?? 0, 6 * HOUR_MS));
  const res = await prisma.publication.updateMany({
    where: { id: pub.id, status: 'SENDING' },
    data: dead
      ? { status: 'DEAD', attemptsCount: attempts, lockedAt: null, lastError: message, scheduledFor: null }
      : { status: 'FAILED', attemptsCount: attempts, lockedAt: null, lastError: message, scheduledFor: addMs(now, wait) },
  });
  if (res.count !== 1) return null;

  if (!dead) {
    await logEvent('WARN', 'publishing', `Falha ao enviar (tentativa ${attempts}/${settings.publishing.maxAttempts}); nova tentativa em ${Math.round(wait / MINUTE_MS)} min`, { publicationId: pub.id, error: message });
    return 'FAILED';
  }
  await settleOfferStatus(pub.offerId);
  await logEvent('ERROR', 'publishing', `Publicação esgotada (DEAD) em "${pub.channel.name}"`, { publicationId: pub.id, attempts, error: message });
  await notify({
    level: 'ERROR',
    type: 'publication_dead',
    title: 'Publicação não enviada',
    body: `"${pub.offer.product.title}" em "${pub.channel.name}" falhou ${opts.permanent ? 'com erro permanente' : `${attempts} vezes`}: ${message}`,
    dedupeKey: `pub-dead:${pub.id}`,
  });
  try {
    await withTimeout(
      addToDeadLetter({
        publicationId: pub.id,
        offerId: pub.offerId,
        channelId: pub.channelId,
        channelName: pub.channel.name,
        productTitle: pub.offer.product.title,
        attempts,
        error: message,
        deadAt: now.toISOString(),
      }),
      5000,
      'dead-letter',
    );
  } catch (err) {
    await logEvent('ERROR', 'publishing', 'Não foi possível registrar na fila dead-letter (a publicação segue como DEAD no banco)', { publicationId: pub.id, err });
  }
  return 'DEAD';
}

// ---------- tick ----------

export interface ProcessDueResult {
  sent: number;
  manualReady: number;
  failed: number;
  skipped: number;
}

/**
 * Um ciclo do publicador: (1) alimenta os canais com ofertas aprovadas; (2) envia as publicações vencidas,
 * melhores scores primeiro, respeitando horário de silêncio, intervalo mínimo e limites POR CANAL.
 */
export async function processDue(nowArg?: Date, deps: Omit<SendDeps, 'now'> = {}): Promise<ProcessDueResult> {
  const now = nowArg ?? new Date();
  const settings = await getSettings();
  const stats: ProcessDueResult = { sent: 0, manualReady: 0, failed: 0, skipped: 0 };

  await autoFeed(now, settings, deps, stats);

  const due = await prisma.publication.findMany({
    where: {
      status: { in: SENDABLE },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      channel: { enabled: true, status: { not: 'AUTH_REQUIRED' } },
    },
    include: { offer: { select: { score: true, product: { select: { category: { select: { id: true, dailyLimit: true } } } } } } },
    take: 200,
  });
  due.sort((a, b) => b.offer.score - a.offer.score || a.createdAt.getTime() - b.createdAt.getTime());

  for (const p of due) {
    const block = await checkWindow(p.channelId, p.offer.product.category, now, settings, { includeReserved: false });
    if (block) {
      stats.skipped++;
      continue;
    }
    try {
      const result = await sendPublication(p.id, { ...deps, now });
      if (result.status === 'SENT') stats.sent++;
      else if (result.status === 'MANUAL_READY') stats.manualReady++;
      else if (result.status === 'FAILED' || result.status === 'DEAD') stats.failed++;
      else stats.skipped++;
    } catch (err) {
      if (!(err instanceof PublishBlockedError)) await logEvent('ERROR', 'publishing', 'Falha inesperada no ciclo de publicação', { publicationId: p.id, err });
      stats.skipped++;
    }
  }
  return stats;
}

/**
 * Alimentação automática por canal: ofertas aprovadas (melhor score primeiro) ainda sem publicação NESTE canal.
 * Canais automáticos exigem autoPublish e score >= minScoreToPublish; a fila manual é sempre alimentada.
 */
async function autoFeed(now: Date, settings: Settings, deps: Omit<SendDeps, 'now'>, stats: ProcessDueResult): Promise<void> {
  const channels = await prisma.publishingChannel.findMany({ where: { enabled: true, status: { not: 'AUTH_REQUIRED' } }, orderBy: { createdAt: 'asc' } });
  const since = new Date(now.getTime() - AUTO_FEED_MAX_AGE_HOURS * HOUR_MS);
  for (const channel of channels) {
    const automatic = isAutomaticChannel(channel.type);
    if (automatic && !settings.publishing.autoPublish) continue;
    const candidates = await prisma.offer.findMany({
      where: {
        status: { in: ['APPROVED', 'QUEUED', 'PUBLISHED'] },
        score: { gte: settings.scoring.minScoreToPublish },
        discoveredAt: { gte: since },
        publications: { none: { channelId: channel.id } },
        product: { status: 'ACTIVE', affiliateLinks: { some: { status: 'VALIDATED' } } },
      },
      orderBy: [{ score: 'desc' }, { discoveredAt: 'desc' }],
      select: { id: true },
      take: AUTO_FEED_CANDIDATES,
    });
    for (const c of candidates) {
      try {
        const created = await enqueueOffer(c.id, { channelId: channel.id, by: 'auto' }, { now, ...(deps.source !== undefined ? { source: deps.source } : {}) });
        if (!automatic) stats.manualReady += created.length;
      } catch (err) {
        if (err instanceof PublishBlockedError) {
          // ritmo/canal esgotado: não adianta tentar as demais ofertas neste canal agora
          if (err.blockCode === 'OUT_OF_WINDOW' || err.blockCode === 'LIMIT_REACHED' || err.blockCode === 'CHANNEL_DISABLED') break;
          continue;
        }
        await logEvent('ERROR', 'publishing', 'Falha ao alimentar canal automaticamente', { offerId: c.id, channelId: channel.id, err });
      }
    }
  }
}

// ---------- ações do administrador ----------

/** FAILED/DEAD/CANCELLED -> de novo na fila (tentativas zeradas; o histórico de tentativas é mantido). */
export async function retryPublication(id: string, by?: string, ip?: string | null): Promise<Publication> {
  const pub = await prisma.publication.findUnique({ where: { id }, include: { channel: true } });
  if (!pub) throw new NotFoundError('Publicação não encontrada.');
  const retryable: PublicationStatus[] = ['FAILED', 'DEAD', 'CANCELLED'];
  if (!retryable.includes(pub.status)) {
    throw new ConflictError(`Só publicações com falha ou canceladas podem ser reenviadas (status atual: ${pub.status}).`, 'PUBLICATION_NOT_RETRYABLE');
  }
  const manual = !isAutomaticChannel(pub.channel.type);
  const now = new Date();
  if (manual) {
    // Canal manual vai direto a MANUAL_READY (não passa por sendPublication): as travas duras valem aqui também —
    // sem link VALIDADO, oferta aprovada, produto ativo e canal habilitado o item não volta para a fila.
    const offer = await prisma.offer.findUnique({ where: { id: pub.offerId }, include: OFFER_INCLUDE });
    if (!offer) throw new NotFoundError('Oferta não encontrada.');
    const block = checkChannel(pub.channel) ?? checkOffer(offer, now) ?? checkProduct(offer.product, now);
    if (block) throw toBlockedError(block);
    if (!(await findValidatedLink(offer.productId))) throw new PublishBlockedError('NO_VALIDATED_LINK');
  }
  const res = await prisma.publication.updateMany({
    where: { id, status: { in: retryable } },
    data: { status: manual ? 'MANUAL_READY' : 'PENDING', scheduledFor: manual ? now : null, attemptsCount: 0, lastError: null, lockedAt: null, sentAt: null },
  });
  if (res.count !== 1) throw new ConflictError('A publicação mudou de estado; atualize e tente novamente.', 'PUBLICATION_STATE_CHANGED');
  await settleOfferStatus(pub.offerId);
  await recordAudit({ userId: by ?? null, action: 'publication.retry', entity: 'Publication', entityId: id, before: { status: pub.status }, ip: ip ?? null });
  if (!manual) {
    // envio imediato pelo worker (decisão do administrador); se a fila estiver fora, o tick pega depois
    await withTimeout(enqueueSendJob(id), 3000, 'fila').catch(() => undefined);
  }
  return reload(id);
}

export async function cancelPublication(id: string, by?: string, ip?: string | null): Promise<Publication> {
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) throw new NotFoundError('Publicação não encontrada.');
  if (pub.status === 'CANCELLED') return pub;
  if (pub.status === 'SENT') throw new ConflictError('A publicação já foi enviada e não pode ser cancelada.', 'PUBLICATION_ALREADY_SENT');
  if (pub.status === 'SENDING') throw new ConflictError('A publicação está sendo enviada agora; aguarde o resultado.', 'PUBLICATION_SENDING');
  const res = await prisma.publication.updateMany({
    where: { id, status: { in: ['PENDING', 'SCHEDULED', 'FAILED', 'DEAD', 'MANUAL_READY'] } },
    data: { status: 'CANCELLED', lockedAt: null, lastError: pub.lastError },
  });
  if (res.count !== 1) throw new ConflictError('A publicação mudou de estado; atualize e tente novamente.', 'PUBLICATION_STATE_CHANGED');
  await settleOfferStatus(pub.offerId);
  await recordAudit({ userId: by ?? null, action: 'publication.cancel', entity: 'Publication', entityId: id, before: { status: pub.status }, ip: ip ?? null });
  return reload(id);
}

/** O administrador publicou à mão: MANUAL_READY -> SENT (confirmação humana). Idempotente. */
export async function markManualSent(id: string, by?: string, ip?: string | null): Promise<Publication> {
  const pub = await prisma.publication.findUnique({ where: { id }, include: { channel: true } });
  if (!pub) throw new NotFoundError('Publicação não encontrada.');
  if (pub.status === 'SENT' && pub.externalMessageId?.startsWith('manual:')) return pub;
  if (pub.status !== 'MANUAL_READY') {
    throw new ConflictError(`Só publicações da fila manual podem ser marcadas como publicadas (status atual: ${pub.status}).`, 'PUBLICATION_NOT_MANUAL_READY');
  }
  const now = new Date();
  const res = await prisma.publication.updateMany({
    where: { id, status: 'MANUAL_READY' },
    data: { status: 'SENT', sentAt: now, externalMessageId: `manual:${by ?? 'admin'}`, attemptsCount: { increment: 1 }, lastError: null },
  });
  if (res.count !== 1) return reload(id);
  await settleOfferStatus(pub.offerId);
  await recordAudit({ userId: by ?? null, action: 'publication.mark-sent', entity: 'Publication', entityId: id, after: { channelId: pub.channelId, manual: true }, ip: ip ?? null });
  await logEvent('INFO', 'publishing', `Publicação marcada como publicada manualmente em "${pub.channel.name}"`, { publicationId: id, by: by ?? null });
  return reload(id);
}

/** Itens da fila manual velhos demais expiram: o preço pode ter mudado e a oferta não deve ser publicada às cegas. */
export async function expireStaleManualQueue(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - MANUAL_QUEUE_MAX_AGE_HOURS * HOUR_MS);
  const stale = await prisma.publication.findMany({ where: { status: 'MANUAL_READY', createdAt: { lt: cutoff } }, select: { id: true, offerId: true } });
  if (stale.length === 0) return 0;
  const res = await prisma.publication.updateMany({
    where: { id: { in: stale.map((s) => s.id) }, status: 'MANUAL_READY' },
    data: { status: 'CANCELLED', lastError: `Expirada após ${MANUAL_QUEUE_MAX_AGE_HOURS}h na fila manual: o preço pode ter mudado` },
  });
  for (const offerId of new Set(stale.map((s) => s.offerId))) await settleOfferStatus(offerId);
  return res.count;
}
