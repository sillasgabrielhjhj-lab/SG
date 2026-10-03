import { z } from "zod";

export const productAttributeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(200),
});

export const productVariantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(60),
  priceCents: z.number().int().positive().nullable(),
  stock: z.number().int().min(0),
});

export const productImageSchema = z.object({
  url: z.string().min(1),
  altText: z.string().optional(),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(3, "Nome muito curto").max(160),
    description: z.string().trim().min(10, "Descreva melhor o produto").max(5000),
    categoryId: z.string().uuid("Selecione uma categoria"),
    brandId: z.string().uuid().optional().nullable(),
    sku: z
      .string()
      .trim()
      .min(2, "SKU muito curto")
      .max(60)
      .regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, traço e underline"),
    priceCents: z.number().int().positive("Preço deve ser maior que zero"),
    compareAtPriceCents: z.number().int().positive().nullable(),
    costCents: z.number().int().nonnegative("Custo não pode ser negativo").nullable(),
    promotionStartsAt: z.date().nullable(),
    promotionEndsAt: z.date().nullable(),
    weightGrams: z.number().int().positive().nullable(),
    heightCm: z.number().positive().nullable(),
    widthCm: z.number().positive().nullable(),
    lengthCm: z.number().positive().nullable(),
    stock: z.number().int().min(0, "Estoque não pode ser negativo"),
    images: z.array(productImageSchema).min(1, "Adicione pelo menos uma imagem"),
    attributes: z.array(productAttributeSchema),
    variants: z.array(productVariantSchema),
  })
  .refine((data) => !data.compareAtPriceCents || data.compareAtPriceCents > data.priceCents, {
    message: "O preço riscado precisa ser maior que o preço de venda",
    path: ["compareAtPriceCents"],
  })
  .refine(
    (data) => !data.promotionStartsAt || !data.promotionEndsAt || data.promotionEndsAt > data.promotionStartsAt,
    { message: "O fim da promoção precisa ser depois do início", path: ["promotionEndsAt"] },
  )
  .refine((data) => Boolean(data.promotionStartsAt) === Boolean(data.promotionEndsAt), {
    message: "Defina início e fim da promoção juntos (ou deixe os dois em branco)",
    path: ["promotionEndsAt"],
  });

export type ProductFormValues = z.infer<typeof productSchema>;
