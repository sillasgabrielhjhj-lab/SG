import "server-only";
import type { BannerPlacement } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { getProductCards, publicProductWhere } from "@/features/catalog/cards.server";
import { getNavCategoryTree } from "@/features/catalog/nav-categories.server";
import type { ProductCardData } from "@/features/catalog/types";

const SECTION = 12;
const POOL = 24;
/** Abaixo disso a home vira uma vitrine única (sem repetir o mesmo produto em várias seções). */
const SHOWCASE_BELOW = 8;
/** Faixas de "Compre por preço" (centavos) e mínimo de produtos para cada uma aparecer. */
const PRICE_BANDS = [10_000, 30_000, 50_000];
const MIN_BAND_PRODUCTS = 4;

export async function getActiveBanners(placement: BannerPlacement, take = 6) {
  const now = new Date();
  return db.banner.findMany({
    where: { placement, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take,
  });
}

export type FlashDeal = {
  /** Término da oferta (a primeira a acabar, quando há várias). */
  endsAt: string | null;
  /** Todos os produtos exibidos terminam juntos (o contador vale para todos). */
  sameEnd: boolean;
  products: ProductCardData[];
  /** Limite promocional real — só quando uma única promoção cobre a vitrine. */
  stock: { limit: number; left: number } | null;
  next: { name: string; startsAt: string } | null;
};

/**
 * Ofertas relâmpago ativas (isFlash) + a próxima agendada. O término e o
 * estoque promocional vêm dos produtos efetivamente exibidos — nunca de uma
 * promoção cujos produtos não aparecem.
 */
export async function getFlashDeal(): Promise<FlashDeal | null> {
  const now = new Date();
  const [active, next] = await Promise.all([
    db.promotion.findMany({
      where: { isFlash: true, status: { not: "CANCELLED" }, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { id: true, stockLimit: true, soldCount: true, items: { select: { productId: true } } },
    }),
    // Próxima: só campanhas da plataforma com ao menos um produto à venda.
    db.promotion.findFirst({
      where: { isFlash: true, storeId: null, status: { not: "CANCELLED" }, startsAt: { gt: now }, items: { some: { product: publicProductWhere } } },
      orderBy: { startsAt: "asc" },
      select: { name: true, startsAt: true },
    }),
  ]);
  const upcoming = next ? { name: next.name, startsAt: next.startsAt.toISOString() } : null;
  const ids = [...new Set(active.flatMap((p) => p.items.map((i) => i.productId)))];
  const cards = ids.length ? await getProductCards({ where: { id: { in: ids } }, orderBy: [{ discountPercent: "desc" }], take: SECTION }) : [];
  // A primeira a terminar vem antes (o contador do topo é o dela).
  const products = cards.filter((p) => p.promotion?.isFlash).sort((a, b) => a.promotion!.endsAt.localeCompare(b.promotion!.endsAt));
  if (!products.length) return upcoming ? { endsAt: null, sameEnd: true, products: [], stock: null, next: upcoming } : null;

  const promoIds = new Set(products.map((p) => p.promotion!.id));
  const only = promoIds.size === 1 ? active.find((p) => promoIds.has(p.id)) : undefined;
  const stock =
    only?.stockLimit
      ? { limit: only.stockLimit, left: Math.max(0, Math.min(only.stockLimit - only.soldCount, products.reduce((s, p) => s + p.totalStock, 0))) }
      : null;
  const endsAt = products[0]!.promotion!.endsAt;
  return { endsAt, sameEnd: products.every((p) => p.promotion!.endsAt === endsAt), products, stock, next: upcoming };
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
  const [mid, strip, categories, flash, dealsPool, officialPool, bestPool, newPool, topPool, popularPool, featuredStores, brands, catalogSize, freeShippingPool, priceBandCounts] = await Promise.all([
    getActiveBanners("HOME_MID", 2),
    getActiveBanners("HOME_STRIP", 1),
    getNavCategoryTree(),
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
    getProductCards({ where: { freeShipping: true, totalStock: { gt: 0 } }, orderBy: [{ salesCount: "desc" }, { discountPercent: "desc" }], take: POOL }),
    Promise.all(PRICE_BANDS.map((maxCents) => db.product.count({ where: { AND: [publicProductWhere, { totalStock: { gt: 0 }, effectivePriceCents: { gt: 0, lte: maxCents } }] } }))),
  ]);
  // Faixas de preço só com produtos reais suficientes (ex.: "Até R$ 100").
  const priceBands = PRICE_BANDS.map((maxCents, i) => ({ maxCents, count: priceBandCounts[i] ?? 0 })).filter((b) => b.count >= MIN_BAND_PRODUCTS);

  const flashProducts = flash?.products ?? [];
  const pool = allocator(flashProducts.map((p) => p.id));

  // Catálogo pequeno: uma vitrine só, cada produto uma vez.
  if (catalogSize < SHOWCASE_BELOW) {
    const showcase = pool.take(newPool, { max: SHOWCASE_BELOW, min: 1 });
    return { mode: "showcase" as const, banners: { mid, strip }, categories, flash, showcase, freeShipping: [] as ProductCardData[], priceBands: [], dayDeals: [], official: [], bestSellers: [], recommended: [], newArrivals: [], topRated: [], featuredStores, brands, shownIds: [...pool.used] };
  }

  // Ranking real primeiro (rótulos Top 1/2/3 precisam bater com as vendas).
  const bestSellers = bestPool.length >= 3 ? bestPool : [];
  bestSellers.forEach((p) => pool.used.add(p.id));
  const dayDeals = pool.take(dealsPool);
  const official = pool.take(officialPool);
  const recommended = pool.take(popularPool);
  const freeShipping = pool.take(freeShippingPool, { min: 4 });
  const newArrivals = pool.take(newPool);
  const topRated = pool.take(topPool, { min: 4 });

  return { mode: "full" as const, banners: { mid, strip }, categories, flash, showcase: [] as ProductCardData[], freeShipping, priceBands, dayDeals, official, bestSellers, recommended, newArrivals, topRated, featuredStores, brands, shownIds: [...pool.used] };
}

export type HomePageData = Awaited<ReturnType<typeof getHomePageData>>;
