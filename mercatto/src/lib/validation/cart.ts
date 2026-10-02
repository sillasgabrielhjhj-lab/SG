import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(10),
});

export const couponSchema = z.object({
  code: z.string().trim().min(1, "Informe um código de cupom").max(40),
});
