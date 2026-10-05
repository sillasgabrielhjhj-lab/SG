import "server-only";
import type { BannerPlacement } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { getProductCards } from "@/features/catalog/cards.server";
import { getCategoryTree } from "@/features/catalog/categories.server";

const SECTION = 12;

export async function getActiveBanners(placement: BannerPlacement, take = 6) {
  const now = new Date();
  return db.banner.findMany({
    where: { placement, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take,
  });
}

/** Oferta relâmpago com término mais próximo + produtos (para o contador regressivo). */
export async function getFlashDeal() {
  const now = new Date();
  const promo = await db.promotion.findFirst({
    where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "asc" },
    select: { id: true, name: true, endsAt: true, stockLimit: true, soldCount: true, items: { select: { productId: true } } },
  });
  if (!promo) return null;
  const allFlash = await db.promotion.findMany({
    where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { items: { select: { productId: true } } },
  });
  const ids = [...new Set(allFlash.flatMap((p) => p.items.map((i) => i.productId)))];
  const products = await getProductCards({ where: { id: { in: ids } }, orderBy: [{ discountPercent: "desc" }], take: SECTION });
  const next = await db.promotion.findFirst({ where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { name: true, startsAt: true } });
  return {
    id: promo.id,
    name: promo.name,
    endsAt: promo.endsAt.toISOString(),
    products: products.filter((p) => p.promotion?.isFlash),
    next: next ? { name: next.name, startsAt: next.startsAt.toISOString() } : null,
  };
}

/** Todas as seções da home em paralelo; cada uma funciona vazia. */
export async function getHomePageData() {
  const now = new Date();
  const [hero, mid, strip, categories, flash, dayDeals, official, bestSellers, newArrivals, topRated, featuredStores, brands, campaign] = await Promise.all([
    getActiveBanners("HOME_HERO"),
    getActiveBanners("HOME_MID", 2),
    getActiveBanners("HOME_STRIP", 1),
    getCategoryTree(),
    getFlashDeal(),
    getProductCards({ where: { discountPercent: { gte: 5 } }, orderBy: [{ discountPercent: "desc" }, { salesCount: "desc" }], take: SECTION }),
    getProductCards({ where: { store: { isOfficial: true }, OR: [{ isFeatured: true }, { discountPercent: { gt: 0 } }] }, orderBy: [{ isFeatured: "desc" }, { discountPercent: "desc" }], take: SECTION }),
    getProductCards({ orderBy: [{ salesCount: "desc" }], take: SECTION }),
    getProductCards({ orderBy: [{ publishedAt: "desc" }], take: SECTION }),
    getProductCards({ where: { ratingCount: { gte: 3 } }, orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }], take: SECTION }),
    db.store.findMany({
      where: { status: "ACTIVE", products: { some: { status: "ACTIVE" } } },
      orderBy: [{ isOfficial: "desc" }, { ratingAvg: "desc" }, { salesCount: "desc" }],
      take: 8,
      select: { id: true, name: true, slug: true, logoUrl: true, isOfficial: true, ratingAvg: true, ratingCount: true, salesCount: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } },
    }),
    db.brand.findMany({ where: { isFeatured: true, products: { some: { status: "ACTIVE", store: { status: "ACTIVE" } } } }, orderBy: { name: "asc" }, take: 16, select: { id: true, name: true, slug: true, logoUrl: true } }),
    db.campaign.findFirst({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: "asc" } }),
  ]);
  const featuredCategories = categories.filter((c) => c.isFeatured).length ? categories.filter((c) => c.isFeatured) : categories;
  // Recomendados: mix das categorias em destaque (melhor avaliados por categoria).
  const recommended = await getProductCards({
    where: { categoryId: { in: featuredCategories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]) }, ratingAvg: { gte: 4 } },
    orderBy: [{ viewCount: "desc" }, { ratingAvg: "desc" }],
    take: SECTION,
  });
  return { banners: { hero, mid, strip }, categories, flash, dayDeals, official, bestSellers, newArrivals, topRated, recommended, featuredStores, brands, campaign };
}

export type HomePageData = Awaited<ReturnType<typeof getHomePageData>>;
