import { describe, it, expect } from "vitest";

import { productSchema } from "@/lib/validation/product";

const validProduct = {
  name: "Produto de Teste",
  description: "Uma descrição longa o suficiente para passar na validação.",
  categoryId: "550e8400-e29b-41d4-a716-446655440000",
  brandId: null,
  sku: "SKU-123",
  priceCents: 5000,
  compareAtPriceCents: null,
  costCents: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  weightGrams: null,
  heightCm: null,
  widthCm: null,
  lengthCm: null,
  stock: 10,
  images: [{ url: "/uploads/foo.png" }],
  attributes: [],
  variants: [],
};

describe("productSchema", () => {
  it("aceita um produto válido mínimo", () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejeita produto sem nenhuma imagem", () => {
    const result = productSchema.safeParse({ ...validProduct, images: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita preço zero ou negativo", () => {
    expect(productSchema.safeParse({ ...validProduct, priceCents: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, priceCents: -100 }).success).toBe(false);
  });

  it("rejeita estoque negativo", () => {
    expect(productSchema.safeParse({ ...validProduct, stock: -1 }).success).toBe(false);
  });

  it("rejeita SKU com espaços ou caracteres inválidos", () => {
    expect(productSchema.safeParse({ ...validProduct, sku: "SKU 123" }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, sku: "SKU@123" }).success).toBe(false);
  });

  it("rejeita categoria que não é um UUID válido", () => {
    expect(productSchema.safeParse({ ...validProduct, categoryId: "not-a-uuid" }).success).toBe(false);
  });

  it("aceita variações com preço nulo (herdam o preço base)", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      variants: [{ name: "Cor: Azul", sku: "SKU-123-AZ", priceCents: null, stock: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita descrição muito curta", () => {
    expect(productSchema.safeParse({ ...validProduct, description: "curta" }).success).toBe(false);
  });

  it("rejeita custo negativo", () => {
    expect(productSchema.safeParse({ ...validProduct, costCents: -100 }).success).toBe(false);
  });

  it("rejeita preço riscado menor ou igual ao preço de venda", () => {
    expect(
      productSchema.safeParse({ ...validProduct, priceCents: 5000, compareAtPriceCents: 5000 }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...validProduct, priceCents: 5000, compareAtPriceCents: 4000 }).success,
    ).toBe(false);
  });

  it("aceita preço riscado maior que o preço de venda", () => {
    expect(
      productSchema.safeParse({ ...validProduct, priceCents: 5000, compareAtPriceCents: 8000 }).success,
    ).toBe(true);
  });

  it("rejeita fim de promoção antes ou igual ao início", () => {
    const start = new Date("2026-01-10T00:00:00Z");
    const beforeStart = new Date("2026-01-05T00:00:00Z");
    expect(
      productSchema.safeParse({
        ...validProduct,
        compareAtPriceCents: 8000,
        promotionStartsAt: start,
        promotionEndsAt: beforeStart,
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        ...validProduct,
        compareAtPriceCents: 8000,
        promotionStartsAt: start,
        promotionEndsAt: start,
      }).success,
    ).toBe(false);
  });

  it("rejeita só início ou só fim de promoção definido", () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        compareAtPriceCents: 8000,
        promotionStartsAt: new Date("2026-01-10T00:00:00Z"),
      }).success,
    ).toBe(false);
  });

  it("aceita início e fim de promoção válidos", () => {
    expect(
      productSchema.safeParse({
        ...validProduct,
        compareAtPriceCents: 8000,
        promotionStartsAt: new Date("2026-01-10T00:00:00Z"),
        promotionEndsAt: new Date("2026-01-20T00:00:00Z"),
      }).success,
    ).toBe(true);
  });
});
