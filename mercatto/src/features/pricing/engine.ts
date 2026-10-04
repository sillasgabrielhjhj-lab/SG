/**
 * MOTOR DE PREÇOS — funções puras (sem I/O), usadas no catálogo, carrinho e
 * checkout. O checkout SEMPRE recalcula no servidor com estes mesmos funções;
 * valores vindos do navegador nunca são confiáveis.
 *
 * Regras:
 *  1. Cada item recebe NO MÁXIMO UMA promoção (a de maior desconto; empate =>
 *     maior prioridade). Promoções não se acumulam entre si.
 *  2. Preço promocional nunca fica abaixo de 1 centavo nem acima do preço base.
 *  3. Promoção com estoque promocional esgotado não se aplica.
 *  4. Cupom aplica-se sobre o subtotal elegível; por padrão NÃO acumula com
 *     itens já promocionados (coupon.stackWithPromotions = false).
 *  5. Desconto total nunca excede o valor elegível; total nunca negativo.
 */
import { allocateProportionally, discountPercent, percentOf } from "@/lib/money";

export type PromotionType = "PERCENT_OFF" | "AMOUNT_OFF" | "FIXED_PRICE";

export type PricingPromotion = {
  id: string;
  name: string;
  type: PromotionType;
  value: number;
  startsAt: Date;
  endsAt: Date;
  isFlash: boolean;
  priority: number;
  stockLimit: number | null;
  soldCount: number;
  perCustomerLimit: number | null;
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED";
};

export type PriceInput = {
  priceCents: number;
  compareAtPriceCents?: number | null;
};

export type EffectivePrice = {
  /** Preço base do anúncio (sem promoção). */
  basePriceCents: number;
  /** Preço final cobrado por unidade. */
  priceCents: number;
  /** Preço "de" exibido riscado (se houver). */
  listPriceCents: number | null;
  /** % de desconto exibido (inteiro). */
  discountPercent: number;
  promotion: Pick<PricingPromotion, "id" | "name" | "isFlash" | "endsAt" | "stockLimit" | "soldCount" | "perCustomerLimit"> | null;
};

export function isPromotionActive(p: PricingPromotion, now: Date = new Date()): boolean {
  if (p.status === "CANCELLED") return false;
  if (now < p.startsAt || now >= p.endsAt) return false;
  if (p.stockLimit !== null && p.soldCount >= p.stockLimit) return false;
  return true;
}

export function promotionState(p: Pick<PricingPromotion, "status" | "startsAt" | "endsAt">, now: Date = new Date()) {
  if (p.status === "CANCELLED") return "CANCELLED" as const;
  if (now < p.startsAt) return "SCHEDULED" as const;
  if (now >= p.endsAt) return "EXPIRED" as const;
  return "ACTIVE" as const;
}

/** Preço unitário após aplicar UMA promoção (limitado a [1, base]). */
export function applyPromotion(basePriceCents: number, promo: Pick<PricingPromotion, "type" | "value">): number {
  let price: number;
  switch (promo.type) {
    case "PERCENT_OFF":
      price = basePriceCents - percentOf(basePriceCents, Math.min(Math.max(promo.value, 0), 90));
      break;
    case "AMOUNT_OFF":
      price = basePriceCents - Math.max(promo.value, 0);
      break;
    case "FIXED_PRICE":
      price = promo.value;
      break;
  }
  return Math.min(basePriceCents, Math.max(1, Math.round(price)));
}

/**
 * Calcula o preço efetivo escolhendo a melhor promoção ativa.
 * `promotions` deve conter apenas as promoções aplicáveis ao produto.
 */
export function computeEffectivePrice(
  input: PriceInput,
  promotions: PricingPromotion[] = [],
  now: Date = new Date(),
): EffectivePrice {
  const base = input.priceCents;
  let best: { price: number; promo: PricingPromotion } | null = null;
  for (const promo of promotions) {
    if (!isPromotionActive(promo, now)) continue;
    const price = applyPromotion(base, promo);
    if (price >= base) continue;
    if (!best || price < best.price || (price === best.price && promo.priority > best.promo.priority)) {
      best = { price, promo };
    }
  }

  const finalPrice = best?.price ?? base;
  const compareAt = input.compareAtPriceCents ?? null;
  // Preço "de": o maior entre o compareAt informado e o preço base quando há promoção.
  const listCandidate = Math.max(compareAt ?? 0, best ? base : 0);
  const listPriceCents = listCandidate > finalPrice ? listCandidate : null;

  return {
    basePriceCents: base,
    priceCents: finalPrice,
    listPriceCents,
    discountPercent: listPriceCents ? discountPercent(listPriceCents, finalPrice) : 0,
    promotion: best
      ? {
          id: best.promo.id,
          name: best.promo.name,
          isFlash: best.promo.isFlash,
          endsAt: best.promo.endsAt,
          stockLimit: best.promo.stockLimit,
          soldCount: best.promo.soldCount,
          perCustomerLimit: best.promo.perCustomerLimit,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------

export type CouponRule = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  maxDiscountCents: number | null;
  minOrderCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  firstPurchaseOnly: boolean;
  stackWithPromotions: boolean;
  productIds: string[];
  categoryIds: string[];
  storeId: string | null;
  isActive: boolean;
};

export type CouponLine = {
  key: string; // identificador da linha (ex.: variantId)
  productId: string;
  categoryId: string;
  /** Categorias ancestrais também são elegíveis (ex.: cupom em "Eletrônicos"). */
  categoryAncestorIds?: string[];
  storeId: string;
  unitPriceCents: number;
  quantity: number;
  hasPromotion: boolean;
};

export type CouponContext = {
  now?: Date;
  userUsageCount: number;
  userCompletedOrders: number;
  shippingCents: number;
};

export type CouponEvaluation =
  | {
      ok: true;
      discountCents: number;
      shippingDiscountCents: number;
      /** Desconto alocado por linha (soma = discountCents). */
      allocations: Record<string, number>;
      eligibleSubtotalCents: number;
    }
  | { ok: false; reason: string };

export function evaluateCoupon(coupon: CouponRule, lines: CouponLine[], ctx: CouponContext): CouponEvaluation {
  const now = ctx.now ?? new Date();
  if (!coupon.isActive) return { ok: false, reason: "Cupom inválido ou inativo." };
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, reason: "Este cupom ainda não está válido." };
  if (coupon.endsAt && now >= coupon.endsAt) return { ok: false, reason: "Este cupom expirou." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "Este cupom atingiu o limite de utilizações." };
  }
  if (coupon.usageLimitPerUser !== null && ctx.userUsageCount >= coupon.usageLimitPerUser) {
    return { ok: false, reason: "Você já utilizou este cupom o máximo de vezes permitido." };
  }
  if (coupon.firstPurchaseOnly && ctx.userCompletedOrders > 0) {
    return { ok: false, reason: "Cupom válido somente para a primeira compra." };
  }

  const restricted = coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
  const eligible = lines.filter((l) => {
    if (coupon.storeId && l.storeId !== coupon.storeId) return false;
    if (!coupon.stackWithPromotions && l.hasPromotion) return false;
    if (!restricted) return true;
    if (coupon.productIds.includes(l.productId)) return true;
    const cats = [l.categoryId, ...(l.categoryAncestorIds ?? [])];
    return cats.some((c) => coupon.categoryIds.includes(c));
  });

  const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  // Valor mínimo considera o carrinho todo (ou apenas a loja, em cupons de vendedor).
  const cartSubtotal = lines
    .filter((l) => !coupon.storeId || l.storeId === coupon.storeId)
    .reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

  if (eligible.length === 0) {
    return {
      ok: false,
      reason: coupon.stackWithPromotions
        ? "Nenhum item do carrinho é elegível para este cupom."
        : "Nenhum item elegível: este cupom não se aplica a produtos já em promoção.",
    };
  }
  if (cartSubtotal < coupon.minOrderCents) {
    return { ok: false, reason: `Valor mínimo para este cupom não atingido.` };
  }

  let discount = 0;
  let shippingDiscount = 0;
  if (coupon.type === "PERCENT") {
    discount = percentOf(eligibleSubtotal, Math.min(coupon.value, 100));
  } else if (coupon.type === "FIXED") {
    discount = coupon.value;
  } else {
    shippingDiscount = ctx.shippingCents;
  }
  if (coupon.maxDiscountCents !== null) {
    discount = Math.min(discount, coupon.maxDiscountCents);
    shippingDiscount = Math.min(shippingDiscount, coupon.maxDiscountCents);
  }
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));
  shippingDiscount = Math.max(0, Math.min(shippingDiscount, ctx.shippingCents));

  const weights = eligible.map((l) => l.unitPriceCents * l.quantity);
  const parts = allocateProportionally(discount, weights);
  const allocations: Record<string, number> = {};
  eligible.forEach((l, i) => {
    allocations[l.key] = parts[i] ?? 0;
  });

  return { ok: true, discountCents: discount, shippingDiscountCents: shippingDiscount, allocations, eligibleSubtotalCents: eligibleSubtotal };
}

// ---------------------------------------------------------------------------
// Totais
// ---------------------------------------------------------------------------

export type TotalsInput = {
  lines: { unitPriceCents: number; quantity: number; originalPriceCents?: number }[];
  shippingCents: number;
  couponDiscountCents?: number;
  couponShippingDiscountCents?: number;
  pixDiscountPercent?: number;
  paymentMethod?: "PIX" | "CREDIT_CARD";
};

export type Totals = {
  itemsCount: number;
  /** Soma dos preços originais (antes de promoção) — usada para "você economiza". */
  originalSubtotalCents: number;
  subtotalCents: number;
  promotionSavingsCents: number;
  couponDiscountCents: number;
  pixDiscountCents: number;
  shippingCents: number;
  totalCents: number;
};

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const original = input.lines.reduce((s, l) => s + (l.originalPriceCents ?? l.unitPriceCents) * l.quantity, 0);
  const coupon = Math.min(input.couponDiscountCents ?? 0, subtotal);
  const shipping = Math.max(0, input.shippingCents - (input.couponShippingDiscountCents ?? 0));
  const afterCoupon = subtotal - coupon;
  const pix =
    input.paymentMethod === "PIX" && input.pixDiscountPercent
      ? percentOf(afterCoupon, Math.min(Math.max(input.pixDiscountPercent, 0), 50))
      : 0;
  const total = Math.max(0, afterCoupon - pix + shipping);
  return {
    itemsCount: input.lines.reduce((s, l) => s + l.quantity, 0),
    originalSubtotalCents: original,
    subtotalCents: subtotal,
    promotionSavingsCents: Math.max(0, original - subtotal),
    couponDiscountCents: coupon,
    pixDiscountCents: pix,
    shippingCents: shipping,
    totalCents: total,
  };
}
