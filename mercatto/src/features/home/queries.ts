import "server-only";
import type { BannerPlacement } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { getProductCards } from "@/features/catalog/cards.server";
import { getCategoryTree } from "@/features/catalog/categories.server";
import type { ProductCardData } from "@/features/catalog/types";

const SECTION = 12;
const POOL = 24;
/** Abaixo disso a home vira uma vitrine única (sem repetir o mesmo produto em várias seções). */
const SHOWCASE_BELOW = 8;

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
  const next = await db.promotion.findFirst({ where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { name: true, startsAt: true } });
  if (!promo) return next ? { id: null, name: null, endsAt: null, products: [] as ProductCardData[], next: { name: next.name, startsAt: next.startsAt.toISOString() } } : null;
  const allFlash = await db.promotion.findMany({
    where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { items: { select: { productId: true } } },
  });
  const ids = [...new Set(allFlash.flatMap((p) => p.items.map((i) => i.productId)))];
  const products = await getProductCards({ where: { id: { in: ids } }, orderBy: [{ discountPercent: "desc" }], take: SECTION });
  return {
    id: promo.id,
    name: promo.name,
    endsAt: promo.endsAt.toISOString(),
    products: products.filter((p) => p.promotion?.isFlash),
    next: next ? { name: next.name, startsAt: next.startsAt.toISOString() } : null,
  };
}

/**
 * Distribui produtos entre as seções sem repetir: cada produto aparece em uma
 * só vitrine (exceto o ranking "Mais vendidos", que precisa ser fiel aos dados).
 * Seção que ficaria com menos de `min` produtos não aparece.
 */
function allocator(initial: Iterable<string>) {
  const used = new Set(initial);
  return {
    used,
    take(pool: ProductCardData[], { max = SECTION, min = 2 }: { max?: number; min?: number } = {}) {
      const out = pool.filter((p) => !used.has(p.id)).slice(0, max);
      if (out.length < min) return [];
      for (const p of out) used.add(p.id);
      return out;
    },
  };
}

/** Todas as seções da home em paralelo; cada uma funciona vazia. */
export async function getHomePageData() {
  const [mid, strip, categories, flash, dealsPool, officialPool, bestPool, newPool, topPool, popularPool, featuredStores, brands, catalogSize] = await Promise.all([
    getActiveBanners("HOME_MID", 2),
    getActiveBanners("HOME_STRIP", 1),
    getCategoryTree(),
    getFlashDeal(),
    getProductCards({ where: { discountPercent: { gte: 5 } }, orderBy: [{ discountPercent: "desc" }, { salesCount: "desc" }], take: POOL }),
    getProductCards({ where: { store: { isOfficial: true }, OR: [{ isFeatured: true }, { discountPercent: { gt: 0 } }] }, orderBy: [{ isFeatured: "desc" }, { discountPercent: "desc" }], take: POOL }),
    getProductCards({ where: { salesCount: { gt: 0 } }, orderBy: [{ salesCount: "desc" }], take: 10 }),
    getProductCards({ orderBy: [{ publishedAt: "desc" }], take: POOL }),
    getProductCards({ where: { ratingCount: { gte: 3 } }, orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }], take: POOL }),
    getProductCards({ orderBy: [{ viewCount: "desc" }, { salesCount: "desc" }, { ratingAvg: "desc" }], take: POOL }),
    db.store.findMany({
      where: { status: "ACTIVE", products: { some: { status: "ACTIVE" } } },
      orderBy: [{ isOfficial: "desc" }, { ratingAvg: "desc" }, { salesCount: "desc" }],
      take: 8,
      select: { id: true, name: true, slug: true, logoUrl: true, isOfficial: true, ratingAvg: true, ratingCount: true, salesCount: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } },
    }),
    db.brand.findMany({ where: { isFeatured: true, products: { some: { status: "ACTIVE", store: { status: "ACTIVE" } } } }, orderBy: { name: "asc" }, take: 16, select: { id: true, name: true, slug: true, logoUrl: true } }),
    db.product.count({ where: { status: "ACTIVE", store: { status: "ACTIVE" } } }),
  ]);

  const flashProducts = flash?.products ?? [];
  const pool = allocator(flashProducts.map((p) => p.id));

  // Catálogo pequeno: uma vitrine só, cada produto uma vez.
  if (catalogSize < SHOWCASE_BELOW) {
    const showcase = pool.take(newPool, { max: SHOWCASE_BELOW, min: 1 });
    return { mode: "showcase" as const, banners: { mid, strip }, categories, flash, showcase, dayDeals: [], official: [], bestSellers: [], recommended: [], newArrivals: [], topRated: [], featuredStores, brands, shownIds: [...pool.used] };
  }

  // Ranking real primeiro (rótulos Top 1/2/3 precisam bater com as vendas).
  const bestSellers = bestPool.length >= 3 ? bestPool : [];
  bestSellers.forEach((p) => pool.used.add(p.id));
  const dayDeals = pool.take(dealsPool);
  const official = pool.take(officialPool);
  const recommended = pool.take(popularPool);
  const newArrivals = pool.take(newPool);
  const topRated = pool.take(topPool, { min: 4 });

  return { mode: "full" as const, banners: { mid, strip }, categories, flash, showcase: [] as ProductCardData[], dayDeals, official, bestSellers, recommended, newArrivals, topRated, featuredStores, brands, shownIds: [...pool.used] };
}

export type HomePageData = Awaited<ReturnType<typeof getHomePageData>>;
