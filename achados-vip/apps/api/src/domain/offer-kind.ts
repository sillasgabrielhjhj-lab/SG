/** Escolha do modelo de mensagem (puro). Só usa fatos reais da fonte: nunca infere cupom, relâmpago ou popularidade. */
import type { OfferKindName, ScoreResult } from './types.js';

/** Vendidos (soldQuantity real) a partir dos quais a oferta é "popular". */
export const POPULAR_MIN_SOLD = 500;

export interface KindInput {
  /** Cupom informado pela fonte (NormalizedListing.coupon). */
  coupon?: { code?: string | null; discountCents?: number | null } | null;
  /** Alternativa para quem só tem o código (ex.: Offer do banco). */
  couponCode?: string | null;
  /** Somente se a fonte indicou explicitamente. */
  flashDeal?: boolean;
  soldQuantity?: number | null;
  score: number;
  tier: ScoreResult['tier'];
  /** Maior desconto VERIFICADO do dia (calculado por quem tem a visão do dia). */
  isTopDiscountOfDay?: boolean;
  /** Sobrescreve POPULAR_MIN_SOLD. */
  popularMinSold?: number;
}

export function hasCoupon(i: Pick<KindInput, 'coupon' | 'couponCode'>): boolean {
  return Boolean(i.couponCode?.trim() || i.coupon?.code?.trim() || (i.coupon?.discountCents ?? 0) > 0);
}

/** Prioridade: cupom > relâmpago > maior desconto do dia > preço excepcional > popular > comum. */
export function chooseKind(i: KindInput): OfferKindName {
  if (hasCoupon(i)) return 'COUPON';
  if (i.flashDeal === true) return 'FLASH';
  if (i.isTopDiscountOfDay === true) return 'TOP_DISCOUNT_OF_DAY';
  if (i.tier === 'EXCEPTIONAL') return 'EXCEPTIONAL_PRICE';
  const sold = i.soldQuantity;
  if (typeof sold === 'number' && Number.isFinite(sold) && sold >= (i.popularMinSold ?? POPULAR_MIN_SOLD)) return 'POPULAR';
  return 'COMMON';
}
