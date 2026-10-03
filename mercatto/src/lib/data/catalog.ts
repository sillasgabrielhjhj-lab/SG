import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  ProductSelect,
  ProductWhereInput,
  ProductOrderByWithRelationInput,
  ProductGetPayload,
} from "@/generated/prisma/models";

export const PAGE_SIZE = 24;

export type SortOption =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "rating"
  | "best_selling";

export type CatalogFilters = {
  q?: string;
  categoryIds?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  brandSlugs?: string[];
  minRating?: number;
  sellerSlug?: string;
  onSale?: boolean;
  sort?: SortOption;
  page?: number;
};

/** Só conta como "em oferta" quem tem preço riscado E, se tiver prazo
 * definido, está dentro da janela — evita mostrar promoção já vencida.
 * Compartilhado entre queryProducts (filtro "só promoções") e
 * getHomeSections (seções de ofertas da home). */
function activePromotionWhere(now: Date) {
  return {
    compareAtPriceCents: { not: null },
    OR: [
      { promotionStartsAt: null, promotionEndsAt: null },
      { promotionStartsAt: { lte: now }, promotionEndsAt: { gte: now } },
    ],
  };
}

const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  priceCents: true,
  compareAtPriceCents: true,
  promotionStartsAt: true,
  promotionEndsAt: true,
  ratingAvg: true,
  ratingCount: true,
  salesCount: true,
  createdAt: true,
  images: { orderBy: { position: "asc" as const }, take: 1 },
  seller: { select: { storeName: true, slug: true } },
} satisfies ProductSelect;

export type ProductCardData = ProductGetPayload<{ select: typeof productCardSelect }>;

function buildOrderBy(sort: SortOption | undefined): ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { priceCents: "asc" };
    case "price_desc":
      return { priceCents: "desc" };
    case "newest":
      return { createdAt: "desc" };
    case "rating":
      return { ratingAvg: "desc" };
    case "best_selling":
      return { salesCount: "desc" };
    default:
      return { salesCount: "desc" };
  }
}

export async function queryProducts(filters: CatalogFilters) {
  const page = Math.max(1, filters.page ?? 1);

  const where: ProductWhereInput = {
    isActive: true,
    ...(filters.categoryIds?.length ? { categoryId: { in: filters.categoryIds } } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { brand: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined
      ? {
          priceCents: {
            ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}),
            ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}),
          },
        }
      : {}),
    ...(filters.brandSlugs?.length ? { brand: { slug: { in: filters.brandSlugs } } } : {}),
    ...(filters.minRating !== undefined ? { ratingAvg: { gte: filters.minRating } } : {}),
    ...(filters.sellerSlug ? { seller: { slug: filters.sellerSlug } } : {}),
    ...(filters.onSale ? activePromotionWhere(new Date()) : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getTopCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: { children: { orderBy: { name: "asc" } } },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: { orderBy: { name: "asc" } },
    },
  });
}

/** IDs da própria categoria + subcategorias diretas (para listar produtos
 * de uma categoria pai incluindo os das filhas). */
export async function getCategoryIdsForListing(categoryId: string) {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  return [categoryId, ...children.map((c) => c.id)];
}

export async function getBrandsForFilter(categoryIds?: string[]) {
  const brands = await prisma.brand.findMany({
    where: categoryIds?.length ? { products: { some: { categoryId: { in: categoryIds } } } } : undefined,
    orderBy: { name: "asc" },
  });
  return brands;
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { position: "asc" } },
      attributes: true,
      variants: { include: { inventory: true } },
      inventory: true,
      brand: true,
      category: { include: { parent: true } },
      seller: true,
      reviews: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      questions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
        take: 10,
      },
    },
  });
}

/** Distribuição real de notas (1 a 5 estrelas) pra um produto — calculada
 * sobre TODAS as avaliações, não só a página de 10 mais recentes exibida
 * na tela. Usar só as 10 carregadas pra calcular porcentagem sub-representa
 * sistematicamente qualquer produto com mais de 10 avaliações. */
export async function getReviewBreakdown(productId: string) {
  const grouped = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId },
    _count: true,
  });
  const countByStar = new Map(grouped.map((g) => [g.rating, g._count]));
  const total = grouped.reduce((sum, g) => sum + g._count, 0);

  return [5, 4, 3, 2, 1].map((star) => {
    const count = countByStar.get(star) ?? 0;
    return { star, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
}

export async function getRelatedProducts(categoryId: string, excludeProductId: string) {
  return prisma.product.findMany({
    where: { categoryId, isActive: true, id: { not: excludeProductId } },
    select: productCardSelect,
    orderBy: { salesCount: "desc" },
    take: 10,
  });
}

export async function getHomeSections() {
  const now = new Date();
  const officialSeller = await prisma.seller.findFirst({ where: { isOfficialStore: true }, select: { id: true } });

  const [deals, mercattoDeals, bestSellers, recommended, under50, under100, under200] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, ...activePromotionWhere(now) },
      select: productCardSelect,
      orderBy: { salesCount: "desc" },
      take: 10,
    }),
    prisma.product.findMany({
      // Sentinela "no-official-seller" garante zero resultados (em vez de
      // ignorar o filtro) se o seed do vendedor oficial ainda não rodou.
      where: { isActive: true, sellerId: officialSeller?.id ?? "no-official-seller", ...activePromotionWhere(now) },
      select: productCardSelect,
      orderBy: { salesCount: "desc" },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: productCardSelect,
      orderBy: { salesCount: "desc" },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: productCardSelect,
      orderBy: { ratingAvg: "desc" },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true, priceCents: { lte: 5000 } },
      select: productCardSelect,
      orderBy: { priceCents: "asc" },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true, priceCents: { gt: 5000, lte: 10000 } },
      select: productCardSelect,
      orderBy: { priceCents: "asc" },
      take: 10,
    }),
    prisma.product.findMany({
      where: { isActive: true, priceCents: { gt: 10000, lte: 20000 } },
      select: productCardSelect,
      orderBy: { priceCents: "asc" },
      take: 10,
    }),
  ]);

  return { deals, mercattoDeals, bestSellers, recommended, under50, under100, under200 };
}

export async function getSearchSuggestions(q: string) {
  if (!q.trim()) return [];
  const products = await prisma.product.findMany({
    where: { isActive: true, name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
    take: 6,
    orderBy: { salesCount: "desc" },
  });
  return products;
}
