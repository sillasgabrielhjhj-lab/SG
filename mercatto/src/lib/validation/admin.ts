import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  parentId: z.string().uuid().optional().nullable(),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Código muito curto")
    .max(40)
    .regex(/^[A-Za-z0-9]+$/, "Use apenas letras e números"),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().int().positive("Valor deve ser maior que zero"),
  minOrderCents: z.number().int().min(0),
  maxUses: z.number().int().positive().nullable(),
  expiresAt: z.string().optional().nullable(),
});
