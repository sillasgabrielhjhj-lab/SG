import { describe, expect, it } from "vitest";
import { isValidGtin } from "@/lib/validators/gtin";
import { productInputSchema } from "@/features/products/schemas";
import { safeRedirectPath } from "@/features/auth/schemas";

const base = {
  name: "Smartphone Exemplo 128 GB",
  description: "Descrição completa do produto com mais de vinte caracteres.",
  categoryId: "cat1",
  condition: "NEW",
  status: "DRAFT",
  sku: "ex-001",
  weightGrams: 200,
  heightCm: 15,
  widthCm: 8,
  lengthCm: 2,
  images: [{ url: "/uploads/products/2026/10/a.webp" }],
  options: [
    { name: "Cor", values: ["Preto", "Branco"] },
    { name: "Armazenamento", values: ["128 GB"] },
  ],
  variants: [
    { sku: "EX-001-P", optionValues: { Cor: "Preto", Armazenamento: "128 GB" }, priceCents: 199990, stock: 5 },
    { sku: "EX-001-B", optionValues: { Cor: "Branco", Armazenamento: "128 GB" }, priceCents: 199990, stock: 0 },
  ],
};

describe("validação de produto", () => {
  it("valida GTIN pelo dígito verificador", () => {
    expect(isValidGtin("7891000315507")).toBe(true);
    expect(isValidGtin("7891000315508")).toBe(false);
    expect(isValidGtin("123")).toBe(false);
  });

  it("aceita produto com variações coerentes e normaliza SKU", () => {
    const parsed = productInputSchema.parse(base);
    expect(parsed.sku).toBe("EX-001");
    expect(parsed.variants).toHaveLength(2);
  });

  it("rejeita combinações repetidas, valores fora das opções e SKUs duplicados", () => {
    const dup = { ...base, variants: [base.variants[0], { ...base.variants[0], sku: "EX-OTHER" }] };
    expect(productInputSchema.safeParse(dup).success).toBe(false);
    const bad = { ...base, variants: [{ ...base.variants[0], optionValues: { Cor: "Azul", Armazenamento: "128 GB" } }] };
    expect(productInputSchema.safeParse(bad).success).toBe(false);
    const sameSku = { ...base, variants: [base.variants[0], { ...base.variants[1], sku: "EX-001-P" }] };
    expect(productInputSchema.safeParse(sameSku).success).toBe(false);
  });

  it("exige preço anterior maior que o preço e foto para publicar", () => {
    const wrongCompare = { ...base, variants: [{ ...base.variants[0], compareAtPriceCents: 100 }, base.variants[1]] };
    expect(productInputSchema.safeParse(wrongCompare).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, status: "ACTIVE", images: [] }).success).toBe(false);
  });

  it("recusa imagens de origem externa (somente upload da plataforma)", () => {
    expect(productInputSchema.safeParse({ ...base, images: [{ url: "https://evil.example.com/x.png" }] }).success).toBe(false);
  });

  it("sem opções exige exatamente uma variação", () => {
    const single = { ...base, options: [], variants: [{ sku: "EX-1", optionValues: {}, priceCents: 1000, stock: 1 }] };
    expect(productInputSchema.safeParse(single).success).toBe(true);
    expect(productInputSchema.safeParse({ ...single, variants: [...single.variants, { ...single.variants[0], sku: "EX-2" }] }).success).toBe(false);
  });
});

describe("redirecionamento seguro", () => {
  it("bloqueia open redirect", () => {
    expect(safeRedirectPath("/minha-conta")).toBe("/minha-conta");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath(undefined, "/x")).toBe("/x");
  });
});
