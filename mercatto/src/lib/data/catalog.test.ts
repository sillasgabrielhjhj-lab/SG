import { describe, it, expect, beforeAll } from "vitest";

import { createTestCategory, createTestSeller, createTestProduct } from "@/test/fixtures";
import { queryProducts } from "@/lib/data/catalog";

describe("queryProducts", () => {
  let categoryId: string;
  let sellerId: string;

  beforeAll(async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    categoryId = category.id;
    sellerId = seller.id;

    await createTestProduct({ sellerId, categoryId, name: "Produto Barato", priceCents: 1000 });
    await createTestProduct({ sellerId, categoryId, name: "Produto Médio", priceCents: 5000 });
    await createTestProduct({ sellerId, categoryId, name: "Produto Caro", priceCents: 20000 });
    await createTestProduct({
      sellerId,
      categoryId,
      name: "Produto Inativo",
      priceCents: 999999,
      isActive: false,
    });
  });

  it("só retorna produtos ativos por padrão", async () => {
    const result = await queryProducts({ categoryIds: [categoryId] });
    expect(result.items.every((p) => p.name !== "Produto Inativo")).toBe(true);
  });

  it("filtra por faixa de preço", async () => {
    const result = await queryProducts({
      categoryIds: [categoryId],
      minPriceCents: 2000,
      maxPriceCents: 15000,
    });
    const names = result.items.map((p) => p.name);
    expect(names).toContain("Produto Médio");
    expect(names).not.toContain("Produto Barato");
    expect(names).not.toContain("Produto Caro");
  });

  it("ordena por menor preço", async () => {
    const result = await queryProducts({ categoryIds: [categoryId], sort: "price_asc" });
    const prices = result.items.map((p) => p.priceCents);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it("ordena por maior preço", async () => {
    const result = await queryProducts({ categoryIds: [categoryId], sort: "price_desc" });
    const prices = result.items.map((p) => p.priceCents);
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices).toEqual(sorted);
  });

  it("busca por nome (case-insensitive)", async () => {
    const result = await queryProducts({ q: "médio" });
    expect(result.items.some((p) => p.name === "Produto Médio")).toBe(true);
  });

  it("não retorna produtos de categorias não incluídas no filtro", async () => {
    const otherCategory = await createTestCategory();
    const result = await queryProducts({ categoryIds: [otherCategory.id] });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("calcula o número de páginas corretamente", async () => {
    const result = await queryProducts({ categoryIds: [categoryId] });
    expect(result.pageCount).toBe(Math.max(1, Math.ceil(result.total / 24)));
  });
});
