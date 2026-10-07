import { z } from "zod";
import { isValidGtin } from "@/lib/validators/gtin";
import { onlyDigits } from "@/lib/format";

const sku = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "SKU muito curto")
  .max(64, "SKU muito longo")
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letras, números, ponto, hífen ou sublinhado");

const gtin = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().transform(onlyDigits).refine(isValidGtin, "EAN/GTIN inválido").optional(),
);

const cents = (label: string) =>
  z.coerce.number({ error: `${label} inválido` }).int(`${label} inválido`).min(1, `${label} deve ser maior que zero`).max(100_000_000, `${label} muito alto`);

/** URLs de imagem aceitas: storage da plataforma ou ilustrações demo. */
export const productImageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) =>
      u.startsWith("/uploads/") ||
      u.startsWith("/demo-assets/") ||
      /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(u),
    "Imagem inválida: envie pelo upload da plataforma",
  );

export const specificationsSchema = z
  .array(
    z.object({
      group: z.string().trim().min(1).max(60),
      items: z
        .array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) }))
        .min(1)
        .max(40),
    }),
  )
  .max(20);

export const productImageInput = z.object({
  id: z.string().max(64).optional(),
  url: productImageUrl,
  storageKey: z.string().max(300).optional().nullable(),
  alt: z.string().trim().max(160).optional().nullable(),
  width: z.number().int().positive().max(20000).optional().nullable(),
  height: z.number().int().positive().max(20000).optional().nullable(),
});

export const variantInput = z
  .object({
    id: z.string().max(64).optional(),
    sku,
    gtin,
    optionValues: z.record(z.string().max(40), z.string().trim().min(1).max(40)),
    // 0 = sem preço definido: permitido só em variação inativa (validado abaixo).
    priceCents: z.coerce.number({ error: "Preço inválido" }).int("Preço inválido").min(0, "Preço inválido").max(100_000_000, "Preço muito alto"),
    compareAtPriceCents: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
    costCents: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
    /** Estoque desejado. Para variantes existentes, aplicado como delta sobre stockBaseline. */
    stock: z.coerce.number().int().min(0, "Estoque não pode ser negativo").max(1_000_000),
    /** Estoque que o editor exibia ao carregar (preserva vendas concorrentes). */
    stockBaseline: z.coerce.number().int().min(0).max(1_000_000).optional(),
    minStock: z.coerce.number().int().min(0).max(100_000).default(0),
    weightGrams: z.coerce.number().int().min(1).max(200_000).optional().nullable(),
    imageIndex: z.number().int().min(0).max(20).optional().nullable(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  })
  .refine((v) => v.status === "INACTIVE" || v.priceCents >= 1, { path: ["priceCents"], message: "Defina o preço (ou desative a variação)" })
  .refine((v) => !v.compareAtPriceCents || v.compareAtPriceCents > v.priceCents, {
    path: ["compareAtPriceCents"],
    message: "O preço anterior deve ser maior que o preço de venda",
  });

export const productInputSchema = z
  .object({
    name: z.string().trim().min(3, "Nome muito curto").max(160, "Máximo de 160 caracteres"),
    slug: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .trim()
        .toLowerCase()
        .max(120)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens")
        .optional(),
    ),
    shortDescription: z.string().trim().max(300).optional().nullable(),
    description: z.string().trim().min(20, "Descreva o produto (mín. 20 caracteres)").max(10_000),
    categoryId: z.string().min(1, "Escolha uma categoria").max(64),
    brandId: z.string().max(64).optional().nullable(),
    condition: z.enum(["NEW", "USED", "REFURBISHED"]),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
    sku,
    gtin,
    tags: z.array(z.string().trim().min(1).max(40, "Cada palavra-chave pode ter até 40 caracteres.")).max(20, "Use no máximo 20 palavras-chave.").default([]),
    warrantyMonths: z.coerce.number().int().min(0).max(120).optional().nullable(),
    warrantyText: z.string().trim().max(500).optional().nullable(),
    includedItems: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    specifications: specificationsSchema.default([]),
    weightGrams: z.coerce.number().int().min(1).max(200_000),
    heightCm: z.coerce.number().int().min(1).max(300),
    widthCm: z.coerce.number().int().min(1).max(300),
    lengthCm: z.coerce.number().int().min(1).max(300),
    freeShipping: z.boolean().default(false),
    seoTitle: z.string().trim().max(70).optional().nullable(),
    seoDescription: z.string().trim().max(160).optional().nullable(),
    /** Somente administradores (ignorado para vendedores). */
    isFeatured: z.boolean().optional(),
    attributes: z.array(z.object({ attributeId: z.string().min(1).max(64), value: z.string().trim().max(120) })).max(50).default([]),
    images: z.array(productImageInput).max(12, "Máximo de 12 imagens").default([]),
    options: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(40),
          values: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
        }),
      )
      .max(3, "Máximo de 3 tipos de variação")
      .default([]),
    variants: z.array(variantInput).min(1, "Cadastre pelo menos uma variação").max(150),
  })
  .superRefine((p, ctx) => {
    const optionNames = p.options.map((o) => o.name.toLowerCase());
    if (new Set(optionNames).size !== optionNames.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Tipos de variação duplicados" });
    }
    for (const [i, o] of p.options.entries()) {
      if (new Set(o.values.map((v) => v.toLowerCase())).size !== o.values.length) {
        ctx.addIssue({ code: "custom", path: ["options", i, "values"], message: `Valores repetidos em "${o.name}"` });
      }
    }
    if (p.options.length === 0 && p.variants.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Sem tipos de variação, cadastre exatamente uma variação" });
    }
    const combos = new Set<string>();
    const skus = new Set<string>();
    for (const [i, v] of p.variants.entries()) {
      const keys = Object.keys(v.optionValues);
      if (keys.length !== p.options.length) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "optionValues"], message: "Preencha todas as opções da variação" });
        continue;
      }
      for (const o of p.options) {
        const val = v.optionValues[o.name];
        if (!val || !o.values.includes(val)) {
          ctx.addIssue({ code: "custom", path: ["variants", i, "optionValues"], message: `Valor inválido para "${o.name}"` });
        }
      }
      const key = p.options.map((o) => v.optionValues[o.name]).join("|");
      if (combos.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i], message: "Combinação de variação repetida" });
      combos.add(key);
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU repetido" });
      skus.add(v.sku);
      if (v.imageIndex !== null && v.imageIndex !== undefined && v.imageIndex >= p.images.length) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "imageIndex"], message: "Imagem da variação inexistente" });
      }
    }
    if (p.status === "ACTIVE" && p.images.length === 0) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "Adicione pelo menos uma foto para publicar" });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const productStatusSchema = z.object({
  productId: z.string().min(1).max(64),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]),
});

export const quickPriceSchema = z
  .object({
    variantId: z.string().min(1).max(64),
    priceCents: cents("Preço"),
    compareAtPriceCents: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  })
  .refine((v) => !v.compareAtPriceCents || v.compareAtPriceCents > v.priceCents, {
    path: ["compareAtPriceCents"],
    message: "O preço anterior deve ser maior que o preço de venda",
  });

export const productListFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "OUT_OF_STOCK", "ARCHIVED"]).optional(),
  categoryId: z.string().max(64).optional(),
  storeId: z.string().max(64).optional(),
  lowStock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(["recent", "name", "price_asc", "price_desc", "stock", "sales"]).default("recent"),
});

export type ProductListFilters = z.infer<typeof productListFiltersSchema>;
