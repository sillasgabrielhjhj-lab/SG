/**
 * DealScoringService — liga o domínio puro (referência verificada, score, tipo de mensagem) aos dados do banco.
 * Nenhum desconto é afirmado sem referência VERIFICADA (histórico próprio); desconto só anunciado não pontua.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { chooseKind, POPULAR_MIN_SOLD } from '../domain/offer-kind.js';
import { verifiedReference, type PricePoint } from '../domain/pricing.js';
import { scoreOffer } from '../domain/scoring.js';
import type { Settings } from '../domain/settings.js';
import type { NormalizedListing, OfferKindName, ScoreResult } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { startOfDayInTz } from '../lib/time.js';

type Client = PrismaClient | Prisma.TransactionClient;

export const REFERENCE_WINDOW_DAYS = 90;
/** "Maior desconto do dia" só vale a partir deste desconto VERIFICADO (%). */
export const TOP_DISCOUNT_MIN_PCT = 20;

export interface EvaluateInput {
  listing: NormalizedListing;
  /** Observações anteriores do produto (sem a atual). */
  history: readonly PricePoint[];
  categoryRelevance: number;
  firstSeenAt: Date;
  now: Date;
  settings: Settings;
}

export interface DealEvaluation {
  result: ScoreResult;
  /** Maior preço observado na janela acima do atual (null sem histórico suficiente). */
  verifiedReferenceCents: number | null;
}

export function evaluateDeal(input: EvaluateInput): DealEvaluation {
  const { listing, history, settings, now } = input;
  const verifiedReferenceCents = verifiedReference(history, listing.priceCents, now, {
    windowDays: REFERENCE_WINDOW_DAYS,
    minObservations: settings.scoring.minHistoryObservations,
  });
  const result = scoreOffer(
    { listing, verifiedReferenceCents, history: [...history], categoryRelevance: input.categoryRelevance, firstSeenAt: input.firstSeenAt, now },
    settings,
  );
  return { result, verifiedReferenceCents };
}

/** Pontuação mínima efetiva: a da categoria (se houver) sobrescreve a global. */
export function effectiveMinScore(categoryMinScore: number | null | undefined, settings: Settings): number {
  return categoryMinScore ?? settings.scoring.minScoreToPublish;
}

/** Maior desconto VERIFICADO entre as ofertas de hoje (fuso das configurações) que não foram rejeitadas/suspensas. 0 se não há. */
export async function todayTopDiscountPct(now: Date, settings: Settings, client: Client = prisma): Promise<number> {
  const start = startOfDayInTz(now, settings.publishing.quietHours.timezone);
  const agg = await client.offer.aggregate({
    _max: { discountPct: true },
    where: { discountVerified: true, discoveredAt: { gte: start, lte: now }, status: { notIn: ['REJECTED', 'SUSPENDED'] } },
  });
  return agg._max.discountPct ?? 0;
}

/** Tipo/modelo de mensagem. "Maior desconto do dia" exige desconto verificado, mínimo e estritamente maior que o de hoje. */
export function dealKind(listing: NormalizedListing, result: ScoreResult, todayTopPct: number): OfferKindName {
  const pct = result.discountPct ?? 0;
  const isTop = result.discountVerified && pct >= TOP_DISCOUNT_MIN_PCT && pct > todayTopPct;
  return chooseKind({
    coupon: listing.coupon ?? null,
    flashDeal: listing.flashDeal === true,
    soldQuantity: listing.soldQuantity ?? null,
    score: result.score,
    tier: result.tier,
    isTopDiscountOfDay: isTop,
  });
}

export const isPopular = (listing: Pick<NormalizedListing, 'soldQuantity'>): boolean =>
  typeof listing.soldQuantity === 'number' && listing.soldQuantity >= POPULAR_MIN_SOLD;
