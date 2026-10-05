import { z } from "zod";
import { cepSchema, cpfOrCnpjSchema, phoneSchema, ufSchema } from "@/lib/validators/br";
import { checkbox, emailSchema, optionalField, optionalText } from "@/lib/validators/common";

export const storeProfileSchema = z.object({
  name: z.string().trim().min(3, "Nome da loja muito curto").max(60, "Máximo de 60 caracteres"),
  description: optionalText(1000),
  document: cpfOrCnpjSchema,
  contactEmail: optionalField(emailSchema),
  contactPhone: optionalField(phoneSchema),
  originCep: cepSchema,
  originCity: optionalText(100),
  originState: optionalField(ufSchema),
  logoUrl: optionalText(500),
  bannerUrl: optionalText(500),
});

export const createStoreSchema = storeProfileSchema.extend({
  acceptSellerTerms: checkbox.refine((v) => v, "Você precisa aceitar os termos para vendedores"),
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;

/** Regras de frete próprias da loja (tabela). */
export const shippingRuleSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(2).max(40),
  regionCode: z.string().trim().toUpperCase().regex(/^(SAME_STATE|SAME_REGION|OTHER|PICKUP|[A-Z]{2})$/, "Região inválida"),
  maxWeightGrams: z.coerce.number().int().min(1).max(200_000),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  additionalKgCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  minDays: z.coerce.number().int().min(0).max(90),
  maxDays: z.coerce.number().int().min(0).max(120),
  isActive: checkbox.default(true),
}).refine((r) => r.maxDays >= r.minDays, { path: ["maxDays"], message: "Prazo máximo menor que o mínimo" });
