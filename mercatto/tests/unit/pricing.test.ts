import { describe, expect, it } from "vitest";
import {
  applyPromotion,
  computeEffectivePrice,
  computeTotals,
  evaluateCoupon,
  type CouponLine,
  type CouponRule,
  type PricingPromotion,
} from "@/features/pricing/engine";

const now = new Date("2026-10-04T12:00:00Z");
const promo = (over: Partial<PricingPromotion> = {}): PricingPromotion => ({
  id: "p1",
  name: "Promo",
  type: "PERCENT_OFF",
  value: 10,
  startsAt: new Date("2026-10-01T00:00:00Z"),
  endsAt: new Date("2026-10-10T00:00:00Z"),
  isFlash: false,
  priority: 0,
  stockLimit: null,
  soldCount: 0,
  perCustomerLimit: null,
  status: "ACTIVE",
  ...over,
});

describe("promoções", () => {
  it("aplica percentual, valor fixo e preço fixo com limites", () => {
    expect(applyPromotion(10000, { type: "PERCENT_OFF", value: 15 })).toBe(8500);
    expect(applyPromotion(10000, { type: "AMOUNT_OFF", value: 2500 })).toBe(7500);
    expect(applyPromotion(10000, { type: "AMOUNT_OFF", value: 50000 })).toBe(1);
    expect(applyPromotion(10000, { type: "FIXED_PRICE", value: 7990 })).toBe(7990);
    expect(applyPromotion(10000, { type: "FIXED_PRICE", value: 12000 })).toBe(10000);
    expect(applyPromotion(10000, { type: "PERCENT_OFF", value: 99 })).toBe(1000); // teto de 90%
  });

  it("escolhe a MELHOR promoção sem acumular", () => {
    const r = computeEffectivePrice({ priceCents: 10000 }, [promo({ value: 10 }), promo({ id: "p2", value: 25 })], now);
    expect(r.priceCents).toBe(7500);
    expect(r.promotion?.id).toBe("p2");
    expect(r.listPriceCents).toBe(10000);
    expect(r.discountPercent).toBe(25);
  });

  it("ignora promoções agendadas, expiradas, canceladas ou com estoque promocional esgotado", () => {
    const list = [
      promo({ id: "future", startsAt: new Date("2026-10-05T00:00:00Z") }),
      promo({ id: "past", endsAt: new Date("2026-10-03T00:00:00Z") }),
      promo({ id: "cancel", status: "CANCELLED" }),
      promo({ id: "soldout", stockLimit: 5, soldCount: 5 }),
    ];
    const r = computeEffectivePrice({ priceCents: 10000, compareAtPriceCents: 12000 }, list, now);
    expect(r.priceCents).toBe(10000);
    expect(r.promotion).toBeNull();
    expect(r.listPriceCents).toBe(12000);
    expect(r.discountPercent).toBe(16);
  });

  it("encerra no instante exato do fim (contador regressivo)", () => {
    const p = promo({ endsAt: now });
    expect(computeEffectivePrice({ priceCents: 10000 }, [p], now).promotion).toBeNull();
  });
});

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1",
  code: "BEMVINDO10",
  type: "PERCENT",
  value: 10,
  maxDiscountCents: null,
  minOrderCents: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usageLimitPerUser: 1,
  usedCount: 0,
  firstPurchaseOnly: false,
  stackWithPromotions: false,
  productIds: [],
  categoryIds: [],
  storeId: null,
  isActive: true,
  ...over,
});

const lines: CouponLine[] = [
  { key: "v1", productId: "a", categoryId: "cel", storeId: "s1", unitPriceCents: 10000, quantity: 1, hasPromotion: false },
  { key: "v2", productId: "b", categoryId: "tv", storeId: "s2", unitPriceCents: 5000, quantity: 2, hasPromotion: false },
  { key: "v3", productId: "c", categoryId: "cel", storeId: "s1", unitPriceCents: 3000, quantity: 1, hasPromotion: true },
];
const ctx = { now, userUsageCount: 0, userCompletedOrders: 0, shippingCents: 2000 };

describe("cupons", () => {
  it("aplica percentual apenas sobre itens elegíveis (sem promoção) e aloca por linha", () => {
    const r = evaluateCoupon(coupon(), lines, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.eligibleSubtotalCents).toBe(20000);
    expect(r.discountCents).toBe(2000);
    expect(r.allocations).toEqual({ v1: 1000, v2: 1000 });
  });

  it("respeita teto de desconto, mínimo do pedido, validade e limites", () => {
    const capped = evaluateCoupon(coupon({ value: 50, maxDiscountCents: 1500 }), lines, ctx);
    expect(capped.ok && capped.discountCents).toBe(1500);
    expect(evaluateCoupon(coupon({ minOrderCents: 999999 }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ endsAt: new Date("2026-10-01T00:00:00Z") }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ usageLimit: 10, usedCount: 10 }), lines, ctx).ok).toBe(false);
    expect(evaluateCoupon(coupon(), lines, { ...ctx, userUsageCount: 1 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ firstPurchaseOnly: true }), lines, { ...ctx, userCompletedOrders: 2 }).ok).toBe(false);
    expect(evaluateCoupon(coupon({ isActive: false }), lines, ctx).ok).toBe(false);
  });

  it("restringe por categoria, produto e loja", () => {
    const byCat = evaluateCoupon(coupon({ categoryIds: ["tv"] }), lines, ctx);
    expect(byCat.ok && byCat.eligibleSubtotalCents).toBe(10000);
    const byStore = evaluateCoupon(coupon({ storeId: "s1" }), lines, ctx);
    expect(byStore.ok && byStore.eligibleSubtotalCents).toBe(10000);
    const stack = evaluateCoupon(coupon({ stackWithPromotions: true }), lines, ctx);
    expect(stack.ok && stack.eligibleSubtotalCents).toBe(23000);
  });

  it("cupom de valor fixo nunca excede o subtotal elegível", () => {
    const r = evaluateCoupon(coupon({ type: "FIXED", value: 999999 }), lines, ctx);
    expect(r.ok && r.discountCents).toBe(20000);
  });

  it("frete grátis zera apenas o frete", () => {
    const r = evaluateCoupon(coupon({ type: "FREE_SHIPPING", value: 0 }), lines, ctx);
    expect(r.ok && r.shippingDiscountCents).toBe(2000);
    expect(r.ok && r.discountCents).toBe(0);
  });
});

describe("totais", () => {
  it("calcula total com cupom, frete e desconto PIX sem valores negativos", () => {
    const t = computeTotals({
      lines: [{ unitPriceCents: 9000, originalPriceCents: 10000, quantity: 2 }],
      shippingCents: 1500,
      couponDiscountCents: 1000,
      pixDiscountPercent: 5,
      paymentMethod: "PIX",
    });
    expect(t.subtotalCents).toBe(18000);
    expect(t.promotionSavingsCents).toBe(2000);
    expect(t.pixDiscountCents).toBe(850);
    expect(t.totalCents).toBe(18000 - 1000 - 850 + 1500);
    const zero = computeTotals({ lines: [{ unitPriceCents: 100, quantity: 1 }], shippingCents: 0, couponDiscountCents: 99999 });
    expect(zero.totalCents).toBe(0);
  });
});
