import { describe, it, expect } from "vitest";

import { placeOrderSchema } from "@/lib/validation/checkout";

const base = {
  addressId: "550e8400-e29b-41d4-a716-446655440000",
  shippingOptionId: "standard" as const,
  paymentMethod: "CREDIT_CARD" as const,
};

describe("placeOrderSchema", () => {
  it("aceita dados mínimos válidos, com 1 parcela por padrão", () => {
    const result = placeOrderSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.installments).toBe(1);
  });

  it("rejeita opção de entrega inválida", () => {
    const result = placeOrderSchema.safeParse({ ...base, shippingOptionId: "teleporte" });
    expect(result.success).toBe(false);
  });

  it("rejeita método de pagamento inválido", () => {
    const result = placeOrderSchema.safeParse({ ...base, paymentMethod: "DINHEIRO" });
    expect(result.success).toBe(false);
  });

  it("rejeita mais de 12 parcelas", () => {
    const result = placeOrderSchema.safeParse({ ...base, installments: 24 });
    expect(result.success).toBe(false);
  });

  it("rejeita endereço que não é um UUID", () => {
    const result = placeOrderSchema.safeParse({ ...base, addressId: "123" });
    expect(result.success).toBe(false);
  });

  it("aceita Pix e boleto sem dados de cartão", () => {
    expect(placeOrderSchema.safeParse({ ...base, paymentMethod: "PIX" }).success).toBe(true);
    expect(placeOrderSchema.safeParse({ ...base, paymentMethod: "BOLETO" }).success).toBe(true);
  });
});
