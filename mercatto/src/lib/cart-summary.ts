// Função pura (sem acesso a banco/cookies), por isso fica fora de
// src/lib/data/cart.ts — aquele arquivo é "server-only" e não pode ser
// importado por componentes client (como o checkout-wizard).

export type CartSummary = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
};

export function computeCartSummary(
  items: { quantity: number; unitPriceCents: number }[],
  coupon: { type: "PERCENTAGE" | "FIXED"; value: number; minOrderCents: number } | null,
  shippingCents: number,
): CartSummary {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  let discountCents = 0;
  if (coupon && subtotalCents >= coupon.minOrderCents) {
    discountCents =
      coupon.type === "PERCENTAGE"
        ? Math.round((subtotalCents * coupon.value) / 100)
        : coupon.value;
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  return { subtotalCents, discountCents, shippingCents, totalCents, itemCount };
}
