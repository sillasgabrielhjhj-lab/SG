import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";
import { checkbox, optionalText } from "@/lib/validators/common";

/** Aceita Date, ISO ou "datetime-local" (Brasília). */
export const dateTimeField = (label: string) =>
  z.preprocess(
    (v) => {
      if (v instanceof Date) return v;
      if (typeof v !== "string" || v.trim() === "") return undefined;
      return parseLocalDateTime(v) ?? new Date(v);
    },
    z.date({ error: `${label} inválida` }).refine((d) => !Number.isNaN(d.getTime()), `${label} inválida`),
  );

const optionalDateTime = (label: string) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), dateTimeField(label).optional());

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

const idList = z.array(z.string().min(1).max(64)).max(500).default([]);

export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(3, "Dê um nome à promoção").max(120),
    type: z.enum(["PERCENT_OFF", "AMOUNT_OFF", "FIXED_PRICE"]),
    /** PERCENT_OFF: 1-90 (%) | AMOUNT_OFF e FIXED_PRICE: centavos. */
    value: z.coerce.number().int().min(1, "Informe o valor do desconto"),
    isFlash: checkbox.default(false),
    startsAt: dateTimeField("Data de início"),
    endsAt: dateTimeField("Data de término"),
    productIds: idList,
    categoryIds: idList,
    stockLimit: optionalInt(1, 1_000_000),
    perCustomerLimit: optionalInt(1, 1000),
    priority: optionalInt(0, 100),
    campaignId: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(64).optional()),
  })
  .superRefine((p, ctx) => {
    if (p.endsAt <= p.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O término deve ser depois do início" });
    if (p.endsAt.getTime() - p.startsAt.getTime() > 366 * 24 * 3600_000) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Duração máxima de 1 ano" });
    }
    if (p.type === "PERCENT_OFF" && (p.value < 1 || p.value > 90)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percentual entre 1% e 90%" });
    }
    if (p.productIds.length === 0 && p.categoryIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Selecione produtos ou categorias" });
    }
    if (p.isFlash && p.productIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Ofertas relâmpago exigem produtos específicos" });
    }
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Código muito curto")
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "Use letras, números, hífen ou sublinhado"),
    description: optionalText(200),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.coerce.number().int().min(0).default(0),
    maxDiscountCents: optionalInt(1, 100_000_000),
    minOrderCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
    startsAt: optionalDateTime("Data de início"),
    endsAt: optionalDateTime("Data de término"),
    usageLimit: optionalInt(1, 10_000_000),
    usageLimitPerUser: optionalInt(1, 1000),
    firstPurchaseOnly: checkbox.default(false),
    stackWithPromotions: checkbox.default(false),
    productIds: idList,
    categoryIds: idList,
    isActive: checkbox.default(true),
    isPublic: checkbox.default(false),
  })
  .superRefine((c, ctx) => {
    if (c.type === "PERCENT" && (c.value < 1 || c.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentual entre 1% e 100%" });
    if (c.type === "FIXED" && c.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Informe o valor do desconto" });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O término deve ser depois do início" });
    if (c.type === "FIXED" && c.minOrderCents > 0 && c.value > c.minOrderCents) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "O desconto não pode ser maior que o pedido mínimo" });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    slug: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").max(80).optional(),
    ),
    description: optionalText(500),
    bannerUrl: optionalText(500),
    themeColor: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional()),
    startsAt: dateTimeField("Data de início"),
    endsAt: dateTimeField("Data de término"),
    isActive: checkbox.default(true),
  })
  .refine((c) => c.endsAt > c.startsAt, { path: ["endsAt"], message: "O término deve ser depois do início" });

export type CampaignInput = z.infer<typeof campaignInputSchema>;
