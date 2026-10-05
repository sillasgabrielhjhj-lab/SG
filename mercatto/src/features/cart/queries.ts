import "server-only";
import { db } from "@/server/db";
import { computeTotals } from "@/features/pricing/engine";
import { getStoreSettings } from "@/features/settings/queries";
import { formatBRL } from "@/lib/money";
import { groupByStore, priceLines, toCouponLines, type PricedLine } from "@/features/cart/pricing.server";
import { validateCouponForLines } from "@/features/coupons/service";
import type { CartIdentity, CartLineAlert, CartLineView, CartStoreGroup, CartView } from "@/features/cart/types";

function toLineView(line: PricedLine): CartLineView {
  const alerts: CartLineAlert[] = [];
  let status: CartLineView["status"] = "OK";
  if (line.availability === "UNAVAILABLE" || line.availability === "OUT_OF_STOCK") {
    status = "UNAVAILABLE";
    alerts.push({ type: "UNAVAILABLE", message: line.availabilityMessage ?? "Produto indisponível." });
  } else if (line.availability === "INSUFFICIENT_STOCK") {
    status = "ADJUST";
    alerts.push({ type: "INSUFFICIENT_STOCK", message: line.availabilityMessage ?? "Estoque insuficiente.", suggestedQuantity: line.maxQuantity });
  }
  if (line.promotionRemaining !== null && line.promotionRemaining > 0 && line.promotionRemaining <= 5 && status === "OK") {
    alerts.push({ type: "PROMOTION_LOW_STOCK", message: `Restam só ${line.promotionRemaining} com o preço promocional.` });
  }
  const promo = line.price.promotion;
  return {
    itemId: line.itemId ?? line.key,
    variantId: line.variantId,
    productId: line.productId,
    productSlug: line.productSlug,
    productName: line.productName,
    variantName: line.variantName,
    optionValues: line.optionValues,
    sku: line.sku,
    imageUrl: line.imageUrl,
    imageAlt: line.imageAlt,
    quantity: line.quantity,
    selected: line.selected,
    stock: line.stock,
    maxQuantity: line.maxQuantity,
    unitPriceCents: line.unitPriceCents,
    originalPriceCents: line.price.basePriceCents,
    listPriceCents: line.price.listPriceCents,
    discountPercent: line.price.discountPercent,
    promotion: promo
      ? { id: promo.id, name: promo.name, isFlash: promo.isFlash, endsAt: promo.endsAt.toISOString(), remaining: line.promotionRemaining, perCustomerLimit: promo.perCustomerLimit }
      : null,
    lineTotalCents: line.lineTotalCents,
    freeShipping: line.freeShipping,
    status,
    alerts,
  };
}

const EMPTY_TOTALS = { itemsCount: 0, originalSubtotalCents: 0, subtotalCents: 0, promotionSavingsCents: 0, couponDiscountCents: 0, totalCents: 0 };

/**
 * Visão completa do carrinho: linhas agrupadas por loja com preço efetivo
 * atual, alertas, cupom avaliado, totais (sem frete — calculado no checkout)
 * e bloqueios de checkout.
 */
export async function getCartView(identity: CartIdentity | null): Promise<CartView> {
  const settings = await getStoreSettings();
  const empty: CartView = {
    cartId: null,
    groups: [],
    count: 0,
    distinctCount: 0,
    selectedCount: 0,
    totals: EMPTY_TOTALS,
    coupon: null,
    minOrderCents: settings.minOrderCents,
    canCheckout: false,
    blockers: [],
    isGuest: !identity?.userId,
  };
  if (!identity) return empty;

  const cart = await db.cart.findUnique({
    where: identity.userId ? { userId: identity.userId } : { guestToken: identity.guestTokenHash },
    select: { id: true, couponCode: true, items: { orderBy: { createdAt: "asc" }, select: { id: true, variantId: true, quantity: true, selected: true } } },
  });
  if (!cart) return empty;

  const lines = await priceLines(cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, itemId: i.id, selected: i.selected })));
  const purchasable = lines.filter((l) => l.selected && l.availability === "AVAILABLE");

  const groups: CartStoreGroup[] = [];
  for (const [, storeLines] of groupByStore(lines)) {
    const store = storeLines[0]!.store;
    const selectedSubtotal = storeLines.filter((l) => l.selected && l.availability === "AVAILABLE").reduce((s, l) => s + l.lineTotalCents, 0);
    const threshold = store.isOfficial ? settings.freeShippingThresholdCents : null;
    groups.push({
      store: { id: store.id, name: store.name, slug: store.slug, isOfficial: store.isOfficial },
      lines: storeLines.map(toLineView),
      selectedSubtotalCents: selectedSubtotal,
      freeShipping: threshold ? { thresholdCents: threshold, remainingCents: Math.max(0, threshold - selectedSubtotal), reached: selectedSubtotal >= threshold } : null,
    });
  }
  // Loja oficial primeiro.
  groups.sort((a, b) => Number(b.store.isOfficial) - Number(a.store.isOfficial));

  let coupon: CartView["coupon"] = null;
  let couponDiscount = 0;
  if (cart.couponCode && purchasable.length) {
    const result = await validateCouponForLines({ code: cart.couponCode, userId: identity.userId ?? null, lines: toCouponLines(purchasable), shippingCents: 0 });
    if (result.ok) {
      couponDiscount = result.evaluation.discountCents;
      const freeShipping = result.coupon.type === "FREE_SHIPPING";
      coupon = {
        code: result.coupon.code,
        ok: true,
        message: freeShipping ? "Frete grátis aplicado no checkout." : `Desconto de ${formatBRL(couponDiscount)} aplicado.`,
        discountCents: couponDiscount,
        freeShipping,
      };
    } else {
      coupon = { code: cart.couponCode, ok: false, message: result.reason, discountCents: 0, freeShipping: false };
    }
  }

  const totals = computeTotals({
    lines: purchasable.map((l) => ({ unitPriceCents: l.unitPriceCents, originalPriceCents: Math.max(l.price.basePriceCents, l.price.listPriceCents ?? 0), quantity: l.quantity })),
    shippingCents: 0,
    couponDiscountCents: couponDiscount,
  });

  const blockers: string[] = [];
  if (purchasable.length === 0 && lines.length > 0) blockers.push("Selecione ao menos um produto disponível.");
  if (lines.some((l) => l.selected && l.availability === "INSUFFICIENT_STOCK")) blockers.push("Ajuste as quantidades dos itens com estoque insuficiente.");
  if (settings.minOrderCents > 0 && totals.subtotalCents < settings.minOrderCents && purchasable.length) {
    blockers.push(`O valor mínimo do pedido é ${formatBRL(settings.minOrderCents)}.`);
  }

  return {
    cartId: cart.id,
    groups,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    distinctCount: lines.length,
    selectedCount: purchasable.reduce((s, l) => s + l.quantity, 0),
    totals: {
      itemsCount: totals.itemsCount,
      originalSubtotalCents: totals.originalSubtotalCents,
      subtotalCents: totals.subtotalCents,
      promotionSavingsCents: totals.promotionSavingsCents,
      couponDiscountCents: totals.couponDiscountCents,
      totalCents: totals.totalCents,
    },
    coupon,
    minOrderCents: settings.minOrderCents,
    canCheckout: purchasable.length > 0 && blockers.length === 0,
    blockers,
    isGuest: !identity.userId,
  };
}
