import { describe, it, expect } from "vitest";

import { computeCartSummary } from "@/lib/cart-summary";

describe("computeCartSummary", () => {
  it("soma subtotal e quantidade de itens corretamente", () => {
    const summary = computeCartSummary(
      [
        { quantity: 2, unitPriceCents: 1000 },
        { quantity: 1, unitPriceCents: 500 },
      ],
      null,
      0,
    );
    expect(summary.subtotalCents).toBe(2500);
    expect(summary.itemCount).toBe(3);
    expect(summary.totalCents).toBe(2500);
  });

  it("aplica cupom percentual quando o pedido mínimo é atingido", () => {
    const summary = computeCartSummary(
      [{ quantity: 1, unitPriceCents: 10000 }],
      { type: "PERCENTAGE", value: 10, minOrderCents: 5000 },
      0,
    );
    expect(summary.discountCents).toBe(1000);
    expect(summary.totalCents).toBe(9000);
  });

  it("não aplica cupom se o pedido mínimo não foi atingido", () => {
    const summary = computeCartSummary(
      [{ quantity: 1, unitPriceCents: 3000 }],
      { type: "PERCENTAGE", value: 10, minOrderCents: 5000 },
      0,
    );
    expect(summary.discountCents).toBe(0);
    expect(summary.totalCents).toBe(3000);
  });

  it("aplica cupom de valor fixo sem deixar o total negativo", () => {
    const summary = computeCartSummary(
      [{ quantity: 1, unitPriceCents: 1000 }],
      { type: "FIXED", value: 5000, minOrderCents: 0 },
      0,
    );
    expect(summary.discountCents).toBe(1000);
    expect(summary.totalCents).toBe(0);
  });

  it("soma o frete ao total, depois de aplicar o desconto", () => {
    const summary = computeCartSummary(
      [{ quantity: 1, unitPriceCents: 10000 }],
      { type: "PERCENTAGE", value: 10, minOrderCents: 0 },
      1500,
    );
    expect(summary.subtotalCents).toBe(10000);
    expect(summary.discountCents).toBe(1000);
    expect(summary.shippingCents).toBe(1500);
    expect(summary.totalCents).toBe(10500);
  });

  it("carrinho vazio resulta em totais zerados", () => {
    const summary = computeCartSummary([], null, 0);
    expect(summary).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 0,
      itemCount: 0,
    });
  });
});
