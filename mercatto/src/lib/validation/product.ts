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

export const productSchema = z.object({
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
  weightGrams: z.number().int().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  widthCm: z.number().positive().nullable(),
  lengthCm: z.number().positive().nullable(),
  stock: z.number().int().min(0, "Estoque não pode ser negativo"),
  images: z.array(productImageSchema).min(1, "Adicione pelo menos uma imagem"),
  attributes: z.array(productAttributeSchema),
  variants: z.array(productVariantSchema),
});

export type ProductFormValues = z.infer<typeof productSchema>;
