import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { slugify } from "@/lib/slug";
import { formatBRL } from "@/lib/money";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import { getCategoryWithDescendantIds } from "@/features/catalog/categories.server";
import type { CampaignInput, CouponInput, PromotionInput } from "@/features/marketing/schemas";

/**
 * Marketing: promoções (inclui ofertas relâmpago), cupons e campanhas.
 * Escopo:
 *  - { kind: "store", storeId }: vendedor — só produtos da própria loja; a
 *    promoção/cupom fica vinculada à loja (storeId) e nunca afeta outras lojas.
 *  - { kind: "platform" }: administrador — campanhas da Mercatto (storeId null).
 */
export type MarketingScope = { kind: "store"; storeId: string } | { kind: "platform" };

function initialStatus(startsAt: Date, endsAt: Date, now = new Date()) {
  if (endsAt <= now) return "EXPIRED" as const;
  return startsAt <= now ? ("ACTIVE" as const) : ("SCHEDULED" as const);
}

async function productsAffectedBy(promo: { productIds: string[]; categoryIds: string[]; storeId: string | null }) {
  const ids = new Set(promo.productIds);
  if (promo.categoryIds.length) {
    const cats = (await Promise.all(promo.categoryIds.map((c) => getCategoryWithDescendantIds(c)))).flat();
    const rows = await db.product.findMany({
      where: { categoryId: { in: cats }, ...(promo.storeId ? { storeId: promo.storeId } : {}), status: { in: ["ACTIVE", "OUT_OF_STOCK", "PAUSED"] } },
      select: { id: true },
      take: 5000,
    });
    rows.forEach((r) => ids.add(r.id));
  }
  return [...ids];
}

async function validatePromotionTargets(scope: MarketingScope, input: PromotionInput) {
  if (input.productIds.length) {
    const products = await db.product.findMany({
      where: { id: { in: input.productIds } },
      select: { id: true, name: true, storeId: true, status: true, variants: { where: { status: "ACTIVE" }, select: { priceCents: true } } },
    });
    if (products.length !== new Set(input.productIds).size) throw new AppError("VALIDATION", "Alguns produtos selecionados não existem.");
    for (const p of products) {
      if (scope.kind === "store" && p.storeId !== scope.storeId) throw forbidden("Você só pode promover produtos da sua loja.");
      if (p.status === "ARCHIVED") throw new AppError("VALIDATION", `"${p.name}" está arquivado.`);
      const minPrice = Math.min(...p.variants.map((v) => v.priceCents));
      if (input.type !== "PERCENT_OFF" && Number.isFinite(minPrice) && input.value >= minPrice) {
        throw new AppError(
          "VALIDATION",
          input.type === "FIXED_PRICE"
            ? `O preço promocional deve ser menor que o preço atual de "${p.name}" (${formatBRL(minPrice)}).`
            : `O desconto deve ser menor que o preço de "${p.name}" (${formatBRL(minPrice)}).`,
        );
      }
    }
  }
  if (input.categoryIds.length) {
    const count = await db.category.count({ where: { id: { in: input.categoryIds } } });
    if (count !== new Set(input.categoryIds).size) throw new AppError("VALIDATION", "Categoria inválida.");
  }
  if (input.campaignId) {
    if (scope.kind !== "platform") throw forbidden("Somente a Mercatto vincula promoções a campanhas.");
    const campaign = await db.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true } });
    if (!campaign) throw new AppError("VALIDATION", "Campanha inválida.");
  }
}

export async function createPromotion(scope: MarketingScope, actorId: string, input: PromotionInput) {
  await validatePromotionTargets(scope, input);
  const storeId = scope.kind === "store" ? scope.storeId : null;
  const promo = await db.promotion.create({
    data: {
      name: input.name,
      type: input.type,
      value: input.value,
      isFlash: input.isFlash,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: initialStatus(input.startsAt, input.endsAt),
      storeId,
      campaignId: scope.kind === "platform" ? (input.campaignId ?? null) : null,
      categoryIds: input.categoryIds,
      stockLimit: input.stockLimit ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      priority: scope.kind === "platform" ? (input.priority ?? 0) : 0,
      items: { create: [...new Set(input.productIds)].map((productId) => ({ productId })) },
    },
    select: { id: true, status: true },
  });
  await audit({ actorId, action: "promotion.created", entityType: "Promotion", entityId: promo.id, after: { ...input, storeId } as unknown as Prisma.InputJsonValue });
  await recomputeProductAggregates(await productsAffectedBy({ productIds: input.productIds, categoryIds: input.categoryIds, storeId }));
  return promo;
}

async function loadScopedPromotion(scope: MarketingScope, id: string) {
  const promo = await db.promotion.findUnique({ where: { id }, include: { items: { select: { productId: true } } } });
  if (!promo) throw notFound("Promoção não encontrada.");
  if (scope.kind === "store" && promo.storeId !== scope.storeId) throw notFound("Promoção não encontrada.");
  if (scope.kind === "platform" && promo.storeId !== null) {
    // Admin pode cancelar promoções de lojas (moderação), mas não editá-las.
    return { promo, readOnly: true };
  }
  return { promo, readOnly: false };
}

export async function updatePromotion(scope: MarketingScope, actorId: string, id: string, input: PromotionInput) {
  const { promo, readOnly } = await loadScopedPromotion(scope, id);
  if (readOnly) throw forbidden("Promoções de lojas parceiras só podem ser canceladas pela administração.");
  if (promo.status === "EXPIRED" || promo.status === "CANCELLED") throw new AppError("UNPROCESSABLE", "Promoções encerradas não podem ser editadas. Crie uma nova.");
  await validatePromotionTargets(scope, input);
  if (input.stockLimit !== undefined && input.stockLimit < promo.soldCount) {
    throw new AppError("VALIDATION", `O estoque promocional não pode ser menor que o já vendido (${promo.soldCount}).`);
  }
  const before = { productIds: promo.items.map((i) => i.productId), categoryIds: promo.categoryIds, storeId: promo.storeId };
  await db.$transaction(async (tx) => {
    await tx.promotionItem.deleteMany({ where: { promotionId: id } });
    await tx.promotion.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        value: input.value,
        isFlash: input.isFlash,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: initialStatus(input.startsAt, input.endsAt),
        categoryIds: input.categoryIds,
        stockLimit: input.stockLimit ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        ...(scope.kind === "platform" ? { priority: input.priority ?? 0, campaignId: input.campaignId ?? null } : {}),
        items: { create: [...new Set(input.productIds)].map((productId) => ({ productId })) },
      },
    });
    await audit(
      {
        actorId,
        action: "promotion.updated",
        entityType: "Promotion",
        entityId: id,
        before: { type: promo.type, value: promo.value, startsAt: promo.startsAt.toISOString(), endsAt: promo.endsAt.toISOString() },
        after: { type: input.type, value: input.value, startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() },
      },
      tx,
    );
  });
  const affected = new Set([...(await productsAffectedBy(before)), ...(await productsAffectedBy({ productIds: input.productIds, categoryIds: input.categoryIds, storeId: promo.storeId }))]);
  await recomputeProductAggregates([...affected]);
}

export async function cancelPromotion(scope: MarketingScope, actorId: string, id: string) {
  const { promo } = await loadScopedPromotion(scope, id);
  if (promo.status === "CANCELLED") return;
  await db.promotion.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit({ actorId, action: "promotion.updated", entityType: "Promotion", entityId: id, before: { status: promo.status }, after: { status: "CANCELLED" } });
  await recomputeProductAggregates(await productsAffectedBy({ productIds: promo.items.map((i) => i.productId), categoryIds: promo.categoryIds, storeId: promo.storeId }));
}

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------

async function validateCouponTargets(scope: MarketingScope, input: CouponInput) {
  if (input.productIds.length) {
    const products = await db.product.findMany({ where: { id: { in: input.productIds } }, select: { storeId: true } });
    if (products.length !== new Set(input.productIds).size) throw new AppError("VALIDATION", "Alguns produtos selecionados não existem.");
    if (scope.kind === "store" && products.some((p) => p.storeId !== scope.storeId)) throw forbidden("Selecione apenas produtos da sua loja.");
  }
  if (input.categoryIds.length) {
    const count = await db.category.count({ where: { id: { in: input.categoryIds } } });
    if (count !== new Set(input.categoryIds).size) throw new AppError("VALIDATION", "Categoria inválida.");
  }
}

function couponData(scope: MarketingScope, input: CouponInput) {
  return {
    code: input.code,
    description: input.description ?? null,
    type: input.type,
    value: input.type === "FREE_SHIPPING" ? 0 : input.value,
    maxDiscountCents: input.maxDiscountCents ?? null,
    minOrderCents: input.minOrderCents,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    usageLimit: input.usageLimit ?? null,
    usageLimitPerUser: input.usageLimitPerUser ?? null,
    // Primeira compra é um benefício de plataforma (vendedores não definem).
    firstPurchaseOnly: scope.kind === "platform" ? input.firstPurchaseOnly : false,
    stackWithPromotions: input.stackWithPromotions,
    productIds: [...new Set(input.productIds)],
    categoryIds: [...new Set(input.categoryIds)],
    isActive: input.isActive,
    isPublic: input.isPublic,
  };
}

export async function createCoupon(scope: MarketingScope, actorId: string, input: CouponInput) {
  await validateCouponTargets(scope, input);
  try {
    const coupon = await db.coupon.create({
      data: { ...couponData(scope, input), storeId: scope.kind === "store" ? scope.storeId : null },
      select: { id: true, code: true },
    });
    await audit({ actorId, action: "coupon.created", entityType: "Coupon", entityId: coupon.id, after: { code: coupon.code, type: input.type, value: input.value } });
    return coupon;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("Já existe um cupom com este código.");
    throw error;
  }
}

async function loadScopedCoupon(scope: MarketingScope, id: string) {
  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) throw notFound("Cupom não encontrado.");
  if (scope.kind === "store" && coupon.storeId !== scope.storeId) throw notFound("Cupom não encontrado.");
  return coupon;
}

export async function updateCoupon(scope: MarketingScope, actorId: string, id: string, input: CouponInput) {
  const coupon = await loadScopedCoupon(scope, id);
  if (scope.kind === "platform" && coupon.storeId) throw forbidden("Cupons de lojas parceiras só podem ser desativados pela administração.");
  await validateCouponTargets(scope, input);
  if (input.usageLimit !== undefined && input.usageLimit < coupon.usedCount) {
    throw new AppError("VALIDATION", `O limite de usos não pode ser menor que os usos já realizados (${coupon.usedCount}).`);
  }
  try {
    await db.coupon.update({ where: { id }, data: couponData(scope, input) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("Já existe um cupom com este código.");
    throw error;
  }
  await audit({
    actorId,
    action: "coupon.updated",
    entityType: "Coupon",
    entityId: id,
    before: { code: coupon.code, type: coupon.type, value: coupon.value, isActive: coupon.isActive },
    after: { code: input.code, type: input.type, value: input.value, isActive: input.isActive },
  });
}

export async function setCouponActive(scope: MarketingScope, actorId: string, id: string, isActive: boolean) {
  const coupon = await loadScopedCoupon(scope, id);
  await db.coupon.update({ where: { id }, data: { isActive } });
  await audit({ actorId, action: "coupon.updated", entityType: "Coupon", entityId: id, before: { isActive: coupon.isActive }, after: { isActive } });
}

// ---------------------------------------------------------------------------
// Campanhas (somente plataforma)
// ---------------------------------------------------------------------------

async function uniqueCampaignSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "campanha";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const taken = await db.campaign.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw conflict("Não foi possível gerar um slug único.");
}

export async function createCampaign(actorId: string, input: CampaignInput) {
  const slug = await uniqueCampaignSlug(input.slug ?? input.name);
  const campaign = await db.campaign.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      bannerUrl: input.bannerUrl ?? null,
      themeColor: input.themeColor ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
    },
    select: { id: true, slug: true },
  });
  await audit({ actorId, action: "promotion.created", entityType: "Campaign", entityId: campaign.id, after: { name: input.name, slug } });
  return campaign;
}

export async function updateCampaign(actorId: string, id: string, input: CampaignInput) {
  const current = await db.campaign.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!current) throw notFound("Campanha não encontrada.");
  const slug = input.slug && input.slug !== current.slug ? await uniqueCampaignSlug(input.slug, id) : current.slug;
  await db.campaign.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      bannerUrl: input.bannerUrl ?? null,
      themeColor: input.themeColor ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
    },
  });
  await audit({ actorId, action: "promotion.updated", entityType: "Campaign", entityId: id, after: { name: input.name, slug } });
  return { id, slug };
}
