import { z } from "zod";
import { checkbox, emailSchema, optionalField, optionalText } from "@/lib/validators/common";
import { dateTimeField } from "@/features/marketing/schemas";

const slug = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").max(80).optional(),
);
const assetUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().trim().max(500).refine((u) => u.startsWith("/") || /^https:\/\//.test(u), "URL inválida").optional(),
);

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug,
  description: optionalText(500),
  icon: optionalText(40),
  imageUrl: assetUrl,
  parentId: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(64).optional()),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: checkbox.default(true),
  isFeatured: checkbox.default(false),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});

export const attributeSchema = z.object({
  categoryId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,40}$/, "Use letras minúsculas, números e _"),
  type: z.enum(["TEXT", "NUMBER", "SELECT", "BOOLEAN"]),
  options: z.array(z.string().trim().min(1).max(40)).max(60).default([]),
  unit: optionalText(10),
  isFilterable: checkbox.default(false),
  isRequired: checkbox.default(false),
  position: z.coerce.number().int().min(0).max(1000).default(0),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug,
  logoUrl: assetUrl,
  isFeatured: checkbox.default(false),
});

export const bannerSchema = z.object({
  title: z.string().trim().min(2).max(90),
  subtitle: optionalText(160),
  eyebrow: optionalText(40),
  ctaLabel: optionalText(30),
  link: z.string().trim().max(300).refine((l) => l.startsWith("/") && !l.startsWith("//"), "Use um link interno (ex.: /ofertas)"),
  imageUrl: assetUrl,
  mobileImageUrl: assetUrl,
  theme: z.enum(["brand", "sun", "ink", "coral", "light"]).default("brand"),
  placement: z.enum(["HOME_HERO", "HOME_MID", "HOME_STRIP", "CATEGORY"]),
  position: z.coerce.number().int().min(0).max(100).default(0),
  startsAt: z.preprocess((v) => (v === "" || v === null ? undefined : v), dateTimeField("Início").optional()),
  endsAt: z.preprocess((v) => (v === "" || v === null ? undefined : v), dateTimeField("Término").optional()),
  isActive: checkbox.default(true),
});

const cents = z.coerce.number().int().min(0).max(100_000_000);

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  tagline: optionalText(120),
  logoUrl: assetUrl,
  faviconUrl: assetUrl,
  contactEmail: optionalField(emailSchema),
  contactPhone: optionalText(20),
  whatsapp: optionalText(20),
  instagram: optionalText(200),
  facebook: optionalText(200),
  tiktok: optionalText(200),
  youtube: optionalText(200),
  x: optionalText(200),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  minOrderCents: cents.default(0),
  freeShippingThresholdCents: z.preprocess((v) => (v === "" || v === null ? undefined : v), cents.optional()),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
  orderReservationMinutes: z.coerce.number().int().min(30, "Mínimo de 30 minutos (exigência do PIX)").max(24 * 60).default(30),
  pixDiscountPercent: z.coerce.number().int().min(0).max(20).default(0),
  maxInstallments: z.coerce.number().int().min(1).max(24).default(12),
  interestFreeInstallments: z.coerce.number().int().min(1).max(24).default(10),
  monthlyInterestBps: z.coerce.number().int().min(0).max(1500).default(199),
  minInstallmentCents: cents.default(500),
  welcomeCouponCode: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : v), z.string().max(40).regex(/^[A-Z0-9_-]*$/, "Use letras, números, - ou _").optional()),
  welcomeCouponReshowDays: z.coerce.number().int().min(1, "Mínimo de 1 dia").max(365).default(7),
}).refine((s) => s.interestFreeInstallments <= s.maxInstallments, { path: ["interestFreeInstallments"], message: "Não pode exceder o máximo de parcelas" });

export const userRoleSchema = z.object({ userId: z.string().min(1).max(64), role: z.enum(["CUSTOMER", "SELLER", "ADMIN", "SUPPORT"]) });
export const userStatusSchema = z.object({ userId: z.string().min(1).max(64), status: z.enum(["ACTIVE", "SUSPENDED"]) });
export const storeStatusSchema = z.object({ storeId: z.string().min(1).max(64), status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]), note: optionalText(300) });
