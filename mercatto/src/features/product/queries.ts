import "server-only";
import { countStoreSales } from "@/features/orders/stats.server";
import { cache } from "react";
import { db } from "@/server/db";
import { computeEffectivePrice } from "@/features/pricing/engine";
import { loadActivePromotionsFor } from "@/features/pricing/promotions.server";
import { getCategoryAncestorsMap, getCategoryBreadcrumb } from "@/features/catalog/categories.server";
import { getProductCards } from "@/features/catalog/cards.server";

export type ProductSpecGroup = { group: string; items: { name: string; value: string }[] };

/** Resolve slug atual ou redirecionamento 301 de um slug antigo. */
export async function resolveProductSlug(slug: string): Promise<{ redirectTo: string } | null> {
  const exists = await db.product.findUnique({ where: { slug }, select: { id: true } });
  if (exists) return null;
  const redirect = await db.slugRedirect.findUnique({ where: { entity_fromSlug: { entity: "PRODUCT", fromSlug: slug } }, select: { toSlug: true } });
  return redirect ? { redirectTo: redirect.toSlug } : null;
}

/**
 * Dados completos da página de produto. DRAFT/ARCHIVED ou loja suspensa => null (404).
 * PAUSED/OUT_OF_STOCK aparecem como indisponíveis.
 */
export const getProductPageData = cache(async (slug: string) => {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      options: { orderBy: { position: "asc" } },
      // Somente variações vendáveis: ativas e com preço definido.
      variants: { where: { status: "ACTIVE", priceCents: { gt: 0 } }, orderBy: { position: "asc" } },
      attributes: { include: { attribute: { select: { name: true, unit: true, position: true } } } },
      brand: { select: { name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true, isOfficial: true, status: true, ratingAvg: true, ratingCount: true, salesCount: true, cancelledCount: true, createdAt: true, logoUrl: true, originCity: true, originState: true } },
    },
  });
  if (!product || product.status === "DRAFT" || product.status === "ARCHIVED" || product.store.status !== "ACTIVE") return null;

  const now = new Date();
  const ancestors = await getCategoryAncestorsMap();
  const promotions = (await loadActivePromotionsFor([{ id: product.id, categoryId: product.categoryId, storeId: product.storeId }], ancestors, now)).get(product.id) ?? [];

  const variants = product.variants.map((v) => {
    const price = computeEffectivePrice({ priceCents: v.priceCents, compareAtPriceCents: v.compareAtPriceCents }, promotions, now);
    return {
      id: v.id,
      sku: v.sku,
      name: v.name,
      optionValues: (v.optionValues ?? {}) as Record<string, string>,
      stock: v.stock,
      imageId: v.imageId,
      priceCents: price.priceCents,
      listPriceCents: price.listPriceCents,
      discountPercent: price.discountPercent,
      promotion: price.promotion ? { id: price.promotion.id, name: price.promotion.name, isFlash: price.promotion.isFlash, endsAt: price.promotion.endsAt.toISOString(), remaining: price.promotion.stockLimit !== null ? Math.max(0, price.promotion.stockLimit - price.promotion.soldCount) : null, perCustomerLimit: price.promotion.perCustomerLimit } : null,
    };
  });

  const [distributionRows, photoReviews, realRating, breadcrumb] = await Promise.all([
    db.review.groupBy({ by: ["rating"], where: { productId: product.id, status: "PUBLISHED" }, _count: { _all: true } }),
    db.review.count({ where: { productId: product.id, status: "PUBLISHED", NOT: { photos: { isEmpty: true } } } }),
    db.review.aggregate({ where: { productId: product.id, status: "PUBLISHED", isDemo: false }, _avg: { rating: true }, _count: { _all: true } }),
    getCategoryBreadcrumb(product.categoryId),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distributionRows.find((d) => d.rating === r)?._count._all ?? 0 }));
  const totalOrders = product.store.salesCount + product.store.cancelledCount;
  const storeSales = await countStoreSales(product.store.id);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    condition: product.condition,
    status: product.status,
    sku: product.sku,
    gtin: product.gtin,
    tags: product.tags,
    warrantyMonths: product.warrantyMonths,
    warrantyText: product.warrantyText,
    includedItems: product.includedItems,
    highlights: product.highlights,
    // Campos preparados no painel e ainda sem valor não aparecem na loja.
    specifications: ((Array.isArray(product.specifications) ? product.specifications : []) as ProductSpecGroup[])
      .map((g) => ({ ...g, items: g.items.filter((i) => i.value?.trim()) }))
      .filter((g) => g.items.length),
    freeShipping: product.freeShipping,
    salesCount: product.salesCount,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    isDemo: product.isDemo,
    isAvailable: product.status === "ACTIVE" && variants.some((v) => v.stock > 0),
    dimensions: { weightGrams: product.weightGrams, heightCm: product.heightCm, widthCm: product.widthCm, lengthCm: product.lengthCm },
    images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? product.name, width: i.width, height: i.height })),
    options: product.options.map((o) => ({ name: o.name, values: o.values })),
    variants,
    attributes: product.attributes
      .sort((a, b) => a.attribute.position - b.attribute.position)
      .map((a) => ({ name: a.attribute.name, value: a.attribute.unit ? `${a.value} ${a.attribute.unit}` : a.value })),
    brand: product.brand,
    category: product.category,
    breadcrumb,
    store: {
      ...product.store,
      salesCount: storeSales,
      cancellationRate: totalOrders > 0 ? product.store.cancelledCount / totalOrders : 0,
    },
    reviews: { distribution, withPhotos: photoReviews, total: distribution.reduce((s, d) => s + d.count, 0) },
    /** Somente avaliações reais (sem DEMO) — usado em dados estruturados (SEO). */
    realRating: realRating._count._all > 0 ? { average: realRating._avg.rating ?? 0, count: realRating._count._all } : null,
    categoryId: product.categoryId,
    brandId: product.brandId,
    effectivePriceCents: product.effectivePriceCents,
    storeId: product.storeId,
  };
});

export type ProductPageData = NonNullable<Awaited<ReturnType<typeof getProductPageData>>>;

const abbreviate = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : parts[0] ?? "Cliente";
};

export async function getProductReviews(productId: string, opts: { page?: number; rating?: number; withPhotos?: boolean; sort?: "recent" | "helpful" | "rating_desc" | "rating_asc" } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 10;
  const where = {
    productId,
    status: "PUBLISHED" as const,
    ...(opts.rating ? { rating: opts.rating } : {}),
    ...(opts.withPhotos ? { NOT: { photos: { isEmpty: true } } } : {}),
  };
  const orderBy =
    opts.sort === "rating_desc" ? [{ rating: "desc" as const }, { createdAt: "desc" as const }] : opts.sort === "rating_asc" ? [{ rating: "asc" as const }, { createdAt: "desc" as const }] : [{ createdAt: "desc" as const }];
  const [rows, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, rating: true, title: true, comment: true, photos: true, isVerifiedPurchase: true, isDemo: true, createdAt: true, user: { select: { name: true } }, orderItem: { select: { variantName: true } } },
    }),
    db.review.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, comment: r.comment, photos: r.photos, isVerifiedPurchase: r.isVerifiedPurchase, isDemo: r.isDemo, createdAt: r.createdAt.toISOString(), author: abbreviate(r.user.name), variantName: r.orderItem?.variantName ?? null })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProductQuestions(productId: string, opts: { page?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 8;
  const where = { productId, status: "PUBLISHED" as const };
  const [rows, total] = await Promise.all([
    db.question.findMany({
      where,
      // Perguntas frequentes da loja primeiro; depois as dos clientes, mais recentes antes.
      orderBy: [{ isFaq: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, body: true, isDemo: true, isFaq: true, createdAt: true, answer: { select: { body: true, createdAt: true } } },
    }),
    db.question.count({ where }),
  ]);
  return {
    items: rows.map((q) => ({ id: q.id, body: q.body, isDemo: q.isDemo, isFaq: q.isFaq, createdAt: q.createdAt.toISOString(), answer: q.answer ? { body: q.answer.body, createdAt: q.answer.createdAt.toISOString() } : null })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Mesma categoria e faixa de preço próxima. */
export async function getRelatedProducts(p: { id: string; categoryId: string; effectivePriceCents: number }, take = 12) {
  const min = Math.floor(p.effectivePriceCents * 0.5);
  const max = Math.ceil(p.effectivePriceCents * 1.8);
  const related = await getProductCards({ where: { categoryId: p.categoryId, id: { not: p.id }, effectivePriceCents: { gte: min, lte: max } }, orderBy: [{ salesCount: "desc" }], take });
  if (related.length >= 4) return related;
  return getProductCards({ where: { categoryId: p.categoryId, id: { not: p.id } }, orderBy: [{ salesCount: "desc" }], take });
}

/** Mesma marca (outras categorias) ou da mesma loja. */
export async function getSimilarProducts(p: { id: string; brandId: string | null; storeId: string }, take = 12) {
  return getProductCards({ where: { id: { not: p.id }, OR: [...(p.brandId ? [{ brandId: p.brandId }] : []), { storeId: p.storeId }] }, orderBy: [{ ratingAvg: "desc" }, { salesCount: "desc" }], take });
}

/** Comprados juntos (co-ocorrência em pedidos pagos), com fallback em relacionados. */
export async function getFrequentlyBoughtTogether(productId: string, take = 4) {
  const rows = await db.$queryRaw<{ productId: string; freq: bigint }[]>`
    SELECT oi2."productId", COUNT(*) AS freq
    FROM "OrderItem" oi1
    JOIN "OrderItem" oi2 ON oi2."orderId" = oi1."orderId" AND oi2."productId" <> oi1."productId"
    JOIN "Order" o ON o."id" = oi1."orderId" AND o."paidAt" IS NOT NULL
    WHERE oi1."productId" = ${productId}
    GROUP BY oi2."productId"
    ORDER BY freq DESC
    LIMIT ${take}`;
  if (!rows.length) return [];
  return getProductCards({ where: { id: { in: rows.map((r) => r.productId) } }, take });
}

/** Visita do dia (agregada) + contador total — atômico. */
export async function recordProductView(productId: string) {
  const day = new Date(new Date().toISOString().slice(0, 10));
  await db.$transaction([
    db.productDailyStat.upsert({ where: { productId_day: { productId, day } }, update: { views: { increment: 1 } }, create: { productId, day, views: 1 } }),
    db.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } }),
  ]);
}
