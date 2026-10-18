/**
 * ProductDiscoveryService — varre as categorias habilitadas, valida, grava histórico, pontua e cria Ofertas.
 *
 * Fluxo por listagem: validar (preço/título/permalink/estoque/anomalia) -> upsert Product (familyKey) ->
 * registrar PriceHistory -> referência VERIFICADA -> score/faixa/tipo -> criar Offer SOMENTE se
 *   (a) não há Offer ativa recente da mesma família com preço menor ou igual (nem rejeição manual equivalente) e
 *   (b) houve queda >= monitoring.minPriceDropPct vs a última observação OU é produto novo qualificado (faixa != BELOW).
 * Status: BELOW => REJECTED (com motivo); score >= mínimo e publishing.autoPublish => APPROVED; senão DISCOVERED.
 * Idempotente: repetir a execução com os mesmos dados não duplica observações nem ofertas.
 * Erro em uma categoria (ou listagem) não derruba as demais; auth/limite de taxa interrompem a rodada (afetariam todas).
 */
import { Prisma, type Category, type OfferStatus, type Product } from '@prisma/client';
import { getConfiguredSource } from '../adapters/sources/index.js';
import { ML_PROVIDER, setMlCredentialStatus } from '../adapters/sources/credentials.js';
import { familyKey } from '../domain/dedupe.js';
import { formatBRL } from '../domain/pricing.js';
import type { Settings } from '../domain/settings.js';
import { SourceAuthError, SourceRateLimitError, type HealthResult, type NormalizedListing, type OfferSource } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { addHours, addMinutes, addDays } from '../lib/time.js';
import { logEvent } from './logs.js';
import { notify, resolveByKey } from './notifications.js';
import { getOrCreateVariantId, loadHistory, recordObservation } from './price-history.js';
import { dealKind, effectiveMinScore, evaluateDeal, isPopular, REFERENCE_WINDOW_DAYS, todayTopDiscountPct } from './scoring-service.js';
import { getSettings } from './settings.js';
import { suspendProduct, validateListing } from './validation.js';

export const DISCOVERY_JOB = 'discovery';
/** Ofertas DISCOVERED/APPROVED que não viraram publicação em 24h expiram (preço e estoque podem ter mudado). */
export const OFFER_TTL_HOURS = 24;

export interface DiscoveryStats {
  found: number;
  upserted: number;
  scored: number;
  approved: number;
  rejected: number;
  suspended: number;
  skipped: number;
}
export interface DiscoveryResult extends DiscoveryStats {
  /** Ofertas criadas (qualquer status). */
  created: number;
  /** Ofertas expiradas/substituídas nesta rodada. */
  expired: number;
  categories: number;
  failedCategories: number;
  errors: string[];
}

const OPEN: OfferStatus[] = ['DISCOVERED', 'APPROVED'];
const ACTIVE: OfferStatus[] = ['DISCOVERED', 'APPROVED', 'QUEUED', 'PUBLISHED'];

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

interface RunCtx {
  now: Date;
  settings: Settings;
  stats: DiscoveryResult;
}

// ---------- produto ----------

function reputationJson(listing: NormalizedListing): Prisma.InputJsonValue | undefined {
  const s = listing.seller;
  if (!s) return undefined;
  const rep: Record<string, string | number> = {};
  if (s.reputationLevel) rep.reputationLevel = s.reputationLevel;
  if (s.powerSellerStatus) rep.powerSellerStatus = s.powerSellerStatus;
  if (typeof s.positiveRatio === 'number') rep.positiveRatio = s.positiveRatio;
  if (typeof s.completedTransactions === 'number') rep.completedTransactions = s.completedTransactions;
  return Object.keys(rep).length ? rep : undefined;
}

async function upsertProduct(listing: NormalizedListing, family: string, categoryId: string, now: Date): Promise<Product> {
  const reputation = reputationJson(listing);
  const data = {
    catalogProductId: listing.catalogProductId ?? null,
    familyKey: family,
    title: listing.title.trim(),
    permalink: listing.permalink,
    thumbnail: listing.thumbnail ?? null,
    imageUrl: listing.imageUrl ?? null,
    categoryId,
    sellerId: listing.seller?.id ?? null,
    sellerName: listing.seller?.name ?? null,
    ...(reputation ? { sellerReputation: reputation } : {}),
    condition: listing.condition ?? null,
    status: 'ACTIVE',
    suspendedUntil: null,
    suspendReason: null,
    lastSeenAt: now,
  };
  const where = { source_externalId: { source: listing.source, externalId: listing.externalId } };
  try {
    return await prisma.product.upsert({ where, create: { source: listing.source, externalId: listing.externalId, ...data }, update: data });
  } catch (err) {
    // corrida na criação (duas rodadas simultâneas): a segunda tentativa cai no caminho de update
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return prisma.product.upsert({ where, create: { source: listing.source, externalId: listing.externalId, ...data }, update: data });
    }
    throw err;
  }
}

/** Expira ofertas abertas do produto (opcionalmente só as de preço menor que `priceBelow`). */
async function expireOpenOffers(productId: string, note: string, opts: { priceBelow?: number } = {}): Promise<number> {
  const res = await prisma.offer.updateMany({
    where: { productId, status: { in: OPEN }, ...(opts.priceBelow !== undefined ? { priceCents: { lt: opts.priceBelow } } : {}) },
    data: { status: 'EXPIRED', decisionNote: note.slice(0, 500) },
  });
  return res.count;
}

// ---------- listagem ----------

async function processListing(rawListing: NormalizedListing, category: Category, ctx: RunCtx): Promise<void> {
  const { now, settings, stats } = ctx;
  // um único instante por rodada: observações, score e recência ficam coerentes
  const listing: NormalizedListing = { ...rawListing, observedAt: now };
  const family = familyKey({ title: listing.title, catalogProductId: listing.catalogProductId });
  if (family === '') {
    stats.skipped++;
    return;
  }

  const existing = await prisma.product.findUnique({ where: { source_externalId: { source: listing.source, externalId: listing.externalId } } });
  if (existing?.suspendedUntil && existing.suspendedUntil > now) {
    stats.skipped++; // suspenso: nada de histórico nem oferta até o fim da suspensão
    return;
  }

  const variantId = existing && listing.variationId ? await getOrCreateVariantId(existing.id, listing.variationId) : null;
  const history = existing ? await loadHistory(existing.id, REFERENCE_WINDOW_DAYS, { variantId, now }) : [];

  const validation = validateListing(listing, { history });
  if (!validation.ok) {
    if (validation.suspend) {
      const product = existing ?? (await upsertProduct(listing, family, category.id, now));
      await suspendProduct(product.id, validation.reason, now);
      stats.suspended++;
      await logEvent('WARN', 'discovery', `Produto ${listing.externalId} suspenso por 24h: ${validation.reason}`, { externalId: listing.externalId, categoria: category.key });
      return;
    }
    stats.skipped++;
    if (existing) {
      if (validation.code === 'OUT_OF_STOCK') {
        await prisma.product.update({ where: { id: existing.id }, data: { status: 'UNAVAILABLE', lastSeenAt: now } });
        stats.expired += await expireOpenOffers(existing.id, 'Produto sem estoque; oferta expirada.');
      }
    }
    return;
  }

  const product = await upsertProduct(listing, family, category.id, now);
  stats.upserted++;
  const resolvedVariant = listing.variationId ? (variantId ?? (await getOrCreateVariantId(product.id, listing.variationId))) : null;

  const prev = history.length ? history[history.length - 1]! : undefined;
  const observation = await recordObservation(listing, product.id, resolvedVariant);

  // preço subiu: ofertas abertas com preço menor ficaram obsoletas
  stats.expired += await expireOpenOffers(product.id, `Preço subiu para ${formatBRL(listing.priceCents)}; oferta expirada.`, { priceBelow: listing.priceCents });

  const { result, verifiedReferenceCents } = evaluateDeal({
    listing,
    history,
    categoryRelevance: category.relevance,
    firstSeenAt: existing?.createdAt ?? product.createdAt,
    now,
    settings,
  });
  stats.scored++;

  const dropPct = prev && prev.priceCents > listing.priceCents ? ((prev.priceCents - listing.priceCents) / prev.priceCents) * 100 : 0;
  const isDrop = dropPct > 0 && dropPct >= settings.monitoring.minPriceDropPct;
  const isNewQualified = !prev && result.tier !== 'BELOW';
  if (!isDrop && !isNewQualified) return;

  const below = result.tier === 'BELOW';
  const recentSince = addDays(now, -Math.max(1, settings.publishing.republishAfterDays));
  const minScore = effectiveMinScore(category.minScore, settings);

  const created = await prisma.$transaction(async (tx) => {
    // serializa a criação por família: duas rodadas simultâneas não duplicam a oferta
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`offer:${family}`}))`;
    const blocker = await tx.offer.findFirst({
      where: {
        product: { familyKey: family },
        priceCents: { lte: listing.priceCents },
        OR: [
          { status: { in: ACTIVE } },
          // rejeição manual equivalente é respeitada; a automática só bloqueia outra rejeição automática
          { status: 'REJECTED', ...(below ? {} : { NOT: { decidedBy: 'auto' } }) },
        ],
        AND: [{ OR: [{ discoveredAt: { gte: recentSince } }, { publications: { some: { sentAt: { gte: recentSince } } } }] }],
      },
      select: { id: true },
    });
    if (blocker) return null;

    const kind = dealKind(listing, result, await todayTopDiscountPct(now, settings, tx));
    let status: OfferStatus = 'DISCOVERED';
    let decisionNote: string | null = null;
    let decidedBy: string | null = null;
    if (below) {
      status = 'REJECTED';
      decidedBy = 'auto';
      decisionNote = `Pontuação ${result.score} abaixo do mínimo para a faixa "bom" (${settings.scoring.thresholds.good}).`;
    } else if (settings.publishing.autoPublish && result.score >= minScore) {
      status = 'APPROVED';
      decidedBy = 'auto';
      decisionNote = `Aprovada automaticamente: pontuação ${result.score} >= mínimo ${minScore}.`;
    }

    // ofertas abertas da família com preço maior ficam substituídas pela nova (mais barata)
    const superseded = await tx.offer.updateMany({
      where: { product: { familyKey: family }, status: { in: OPEN }, priceCents: { gt: listing.priceCents } },
      data: { status: 'EXPIRED', decisionNote: 'Substituída por oferta com preço menor.' },
    });
    stats.expired += superseded.count;

    return tx.offer.create({
      data: {
        productId: product.id,
        priceHistoryId: observation.id,
        status,
        tier: result.tier,
        kind,
        score: result.score,
        scoreBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        priceCents: listing.priceCents,
        originalPriceCents: result.discountVerified ? verifiedReferenceCents : null, // só referência VERIFICADA
        discountPct: result.discountPct,
        savingsCents: result.savingsCents,
        discountVerified: result.discountVerified,
        couponCode: listing.coupon?.code ?? null,
        couponDiscountCents: listing.coupon?.discountCents ?? null,
        ...(listing.installments ? { installments: listing.installments as unknown as Prisma.InputJsonValue } : {}),
        flash: listing.flashDeal === true,
        popular: isPopular(listing),
        decidedBy,
        decisionNote,
        discoveredAt: now,
        decidedAt: decidedBy ? now : null,
        expiresAt: addHours(now, OFFER_TTL_HOURS),
      },
    });
  });

  if (!created) return;
  stats.created++;
  if (created.status === 'APPROVED') stats.approved++;
  else if (created.status === 'REJECTED') stats.rejected++;
}

// ---------- categoria ----------

async function discoverCategory(source: OfferSource, category: Category, ctx: RunCtx): Promise<void> {
  const listings = await source.fetchListings({
    mlCategoryIds: category.mlCategoryIds,
    searchTerms: category.searchTerms,
    limit: ctx.settings.monitoring.maxItemsPerCategory,
  });
  const warnings = (source as { lastWarnings?: string[] }).lastWarnings;
  if (warnings?.length) await logEvent('WARN', 'discovery', `Avisos da fonte em "${category.name}"`, { avisos: warnings.slice(0, 10) });

  const unique = new Map<string, NormalizedListing>();
  for (const l of listings) unique.set(`${l.source}:${l.externalId}:${l.variationId ?? ''}`, l);
  const batch = [...unique.values()].slice(0, ctx.settings.monitoring.maxItemsPerCategory);
  ctx.stats.found += batch.length;

  for (const listing of batch) {
    try {
      await processListing(listing, category, ctx);
    } catch (err) {
      ctx.stats.skipped++;
      await logEvent('ERROR', 'discovery', `Falha ao processar ${listing.externalId}: ${errMsg(err)}`, { externalId: listing.externalId, categoria: category.key });
    }
  }
}

// ---------- job e status da fonte ----------

async function heartbeat(): Promise<void> {
  await prisma.scheduledJob.update({ where: { name: DISCOVERY_JOB }, data: { heartbeatAt: new Date() } }).catch(() => undefined);
}

async function reportSourceOutcome(source: OfferSource, outcome: 'ok' | 'auth' | 'error', detail: string): Promise<void> {
  if (source.name !== ML_PROVIDER) return;
  const key = `integration_auth_required:${ML_PROVIDER}`;
  if (outcome === 'ok') {
    await setMlCredentialStatus('CONNECTED');
    await resolveByKey(key);
    await resolveByKey(`source_error:${ML_PROVIDER}`);
  } else if (outcome === 'auth') {
    await setMlCredentialStatus('AUTH_REQUIRED');
    await notify({ level: 'ERROR', type: 'integration_auth_required', title: 'Mercado Livre: autenticação necessária', body: detail, dedupeKey: key });
  } else {
    await setMlCredentialStatus('ERROR');
    await notify({ level: 'ERROR', type: 'source_error', title: 'Falha ao consultar o Mercado Livre', body: detail, dedupeKey: `source_error:${ML_PROVIDER}` });
  }
}

export async function runDiscovery(opts: { source?: OfferSource; now?: Date } = {}): Promise<DiscoveryResult> {
  const startedMs = Date.now();
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const stats: DiscoveryResult = { found: 0, upserted: 0, scored: 0, approved: 0, rejected: 0, suspended: 0, skipped: 0, created: 0, expired: 0, categories: 0, failedCategories: 0, errors: [] };
  const ctx: RunCtx = { now, settings, stats };
  const everyMs = settings.monitoring.intervalMinutes * 60_000;

  await prisma.scheduledJob.upsert({
    where: { name: DISCOVERY_JOB },
    create: { name: DISCOVERY_JOB, queue: 'discovery', everyMs, status: 'RUNNING', lastRunAt: now, heartbeatAt: new Date(), runCount: 1 },
    update: { status: 'RUNNING', lastRunAt: now, heartbeatAt: new Date(), runCount: { increment: 1 } },
  });

  let fatal: string | null = null;
  let authError = false;
  let attempted = 0;
  let source: OfferSource | null = null;
  try {
    source = opts.source ?? (await getConfiguredSource(settings));
    const categories = await prisma.category.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    stats.categories = categories.length;
    if (categories.length === 0) await logEvent('INFO', 'discovery', 'Nenhuma categoria habilitada; nada a buscar.');

    for (const category of categories) {
      if (category.mlCategoryIds.length === 0 && category.searchTerms.length === 0) {
        await logEvent('WARN', 'discovery', `Categoria "${category.name}" sem ID do Mercado Livre nem termos de busca; ignorada.`);
        continue;
      }
      attempted++;
      try {
        await discoverCategory(source, category, ctx);
      } catch (err) {
        stats.failedCategories++;
        const message = `${category.name}: ${errMsg(err)}`;
        stats.errors.push(message);
        await logEvent('ERROR', 'discovery', `Falha na categoria "${category.name}": ${errMsg(err)}`, { categoria: category.key, tipo: err instanceof Error ? err.name : 'erro' });
        if (err instanceof SourceAuthError) {
          authError = true;
          break; // as demais categorias falhariam do mesmo jeito
        }
        if (err instanceof SourceRateLimitError) break; // insistir só pioraria o limite
      }
      await heartbeat();
    }

    stats.expired += (
      await prisma.offer.updateMany({
        where: { status: { in: OPEN }, expiresAt: { lte: now } },
        data: { status: 'EXPIRED', decisionNote: 'Expirada por tempo; preço e estoque podem ter mudado.' },
      })
    ).count;
  } catch (err) {
    fatal = errMsg(err);
    stats.errors.push(fatal);
    await logEvent('ERROR', 'discovery', `Falha na descoberta: ${fatal}`);
    if (err instanceof SourceAuthError) authError = true;
  }

  const succeeded = attempted - stats.failedCategories;
  const ok = !fatal && !authError && (attempted === 0 || succeeded > 0);
  if (source) {
    if (authError) await reportSourceOutcome(source, 'auth', stats.errors.join(' | ').slice(0, 500));
    else if (attempted > 0 && succeeded === 0) await reportSourceOutcome(source, 'error', stats.errors.join(' | ').slice(0, 500));
    else if (succeeded > 0) await reportSourceOutcome(source, 'ok', '');
  }

  const lastError = stats.errors.length ? stats.errors.join(' | ').slice(0, 1000) : stats.categories === 0 ? 'Nenhuma categoria habilitada.' : null;
  await prisma.scheduledJob.update({
    where: { name: DISCOVERY_JOB },
    data: {
      status: ok ? 'SUCCEEDED' : 'FAILED',
      ...(ok ? { lastSuccessAt: now } : { failCount: { increment: 1 } }),
      lastError,
      lastDurationMs: Date.now() - startedMs,
      heartbeatAt: new Date(),
      lastStats: stats as unknown as Prisma.InputJsonValue,
      nextRunAt: settings.monitoring.enabled ? addMinutes(now, settings.monitoring.intervalMinutes) : null,
    },
  });
  await logEvent(ok ? 'INFO' : 'ERROR', 'discovery', `Descoberta ${ok ? 'concluída' : 'com falha'}: ${stats.found} encontrados, ${stats.created} ofertas (${stats.approved} aprovadas, ${stats.rejected} rejeitadas), ${stats.suspended} suspensos, ${stats.skipped} ignorados.`, stats);
  return stats;
}

/** Testa a fonte configurada (healthCheck) e atualiza o status/alerta da integração. */
export async function testSourceConnection(source?: OfferSource): Promise<HealthResult> {
  const s = source ?? (await getConfiguredSource(await getSettings()));
  const health = await s.healthCheck();
  if (s.name === ML_PROVIDER) {
    await setMlCredentialStatus(health.status);
    if (health.status === 'AUTH_REQUIRED') {
      await notify({ level: 'ERROR', type: 'integration_auth_required', title: 'Mercado Livre: autenticação necessária', body: health.detail, dedupeKey: `integration_auth_required:${ML_PROVIDER}` });
    } else if (health.ok) {
      await resolveByKey(`integration_auth_required:${ML_PROVIDER}`);
    }
  }
  return health;
}
