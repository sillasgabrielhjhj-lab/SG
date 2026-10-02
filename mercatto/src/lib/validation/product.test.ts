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
});
