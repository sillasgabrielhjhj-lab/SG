import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { promotionState } from "@/features/pricing/engine";
import type { MarketingScope } from "@/features/marketing/service";

const PAGE = 20;

export type PromotionListFilters = { state?: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED"; flash?: boolean; page?: number; storeId?: string };

/** Promoções no escopo (estado efetivo calculado pelas datas). */
export async function listPromotions(scope: MarketingScope | { kind: "all" }, filters: PromotionListFilters = {}) {
  const now = new Date();
  const page = Math.max(1, filters.page ?? 1);
  const stateWhere: Prisma.PromotionWhereInput =
    filters.state === "CANCELLED"
      ? { status: "CANCELLED" }
      : filters.state === "SCHEDULED"
        ? { status: { not: "CANCELLED" }, startsAt: { gt: now } }
        : filters.state === "ACTIVE"
          ? { status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } }
          : filters.state === "EXPIRED"
            ? { status: { not: "CANCELLED" }, endsAt: { lte: now } }
            : {};
  const where: Prisma.PromotionWhereInput = {
    ...(scope.kind === "store" ? { storeId: scope.storeId } : scope.kind === "platform" ? { storeId: null } : filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.flash ? { isFlash: true } : {}),
    ...stateWhere,
  };
  const [rows, total] = await Promise.all([
    db.promotion.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        status: true,
        isFlash: true,
        startsAt: true,
        endsAt: true,
        stockLimit: true,
        soldCount: true,
        perCustomerLimit: true,
        categoryIds: true,
        store: { select: { name: true, isOfficial: true } },
        campaign: { select: { name: true, slug: true } },
        _count: { select: { items: true } },
      },
    }),
    db.promotion.count({ where }),
  ]);
  const items = rows.map((p) => ({ ...p, state: promotionState(p, now) }));
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getPromotionForEdit(scope: MarketingScope, id: string) {
  const promo = await db.promotion.findUnique({
    where: { id },
    include: { items: { select: { product: { select: { id: true, name: true, sku: true, minPriceCents: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } } },
  });
  if (!promo) throw notFound("Promoção não encontrada.");
  if (scope.kind === "store" && promo.storeId !== scope.storeId) throw notFound("Promoção não encontrada.");
  if (scope.kind === "platform" && promo.storeId !== null) throw notFound("Promoção não encontrada.");
  return { ...promo, state: promotionState(promo), products: promo.items.map((i) => i.product) };
}

export async function listCoupons(scope: MarketingScope | { kind: "all" }, filters: { active?: boolean; q?: string; page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.CouponWhereInput = {
    ...(scope.kind === "store" ? { storeId: scope.storeId } : scope.kind === "platform" ? { storeId: null } : {}),
    ...(filters.active !== undefined ? { isActive: filters.active } : {}),
    ...(filters.q ? { code: { contains: filters.q.toUpperCase() } } : {}),
  };
  const [items, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { store: { select: { name: true } }, _count: { select: { redemptions: true } } },
    }),
    db.coupon.count({ where }),
  ]);
  const now = new Date();
  return {
    items: items.map((c) => ({
      ...c,
      state: !c.isActive
        ? ("INACTIVE" as const)
        : c.endsAt && c.endsAt <= now
          ? ("EXPIRED" as const)
          : c.startsAt && c.startsAt > now
            ? ("SCHEDULED" as const)
            : c.usageLimit !== null && c.usedCount >= c.usageLimit
              ? ("EXHAUSTED" as const)
              : ("ACTIVE" as const),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE)),
  };
}

export async function getCouponForEdit(scope: MarketingScope, id: string) {
  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) throw notFound("Cupom não encontrado.");
  if (scope.kind === "store" && coupon.storeId !== scope.storeId) throw notFound("Cupom não encontrado.");
  if (scope.kind === "platform" && coupon.storeId !== null) throw notFound("Cupom não encontrado.");
  return coupon;
}

export async function listCampaigns(page = 1) {
  const [items, total] = await Promise.all([
    db.campaign.findMany({ orderBy: { startsAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { _count: { select: { promotions: true } } } }),
    db.campaign.count(),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getCampaign(id: string) {
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) throw notFound("Campanha não encontrada.");
  return campaign;
}

/** Produtos selecionáveis para promoções/cupons (busca leve por nome/SKU). */
export async function searchSelectableProducts(scope: MarketingScope, q: string, take = 20) {
  return db.product.findMany({
    where: {
      ...(scope.kind === "store" ? { storeId: scope.storeId } : {}),
      status: { in: ["ACTIVE", "OUT_OF_STOCK", "PAUSED", "DRAFT"] },
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { salesCount: "desc" },
    take: Math.min(take, 50),
    select: { id: true, name: true, sku: true, minPriceCents: true, status: true, store: { select: { name: true } }, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
  });
}
