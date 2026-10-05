import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { computeEffectivePrice } from "@/features/pricing/engine";
import { loadActivePromotionsFor } from "@/features/pricing/promotions.server";
import { getCategoryAncestorsMap } from "@/features/catalog/categories.server";
import type { ProductCardData } from "@/features/catalog/types";

/** Status visíveis em listagens públicas. */
export const LISTABLE_STATUSES = ["ACTIVE"] as const;

/** Filtro base de visibilidade pública (produto ativo + loja ativa). */
export const publicProductWhere: Prisma.ProductWhereInput = { status: { in: [...LISTABLE_STATUSES] }, store: { status: "ACTIVE" } };

export const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  condition: true,
  categoryId: true,
  storeId: true,
  freeShipping: true,
  totalStock: true,
  salesCount: true,
  ratingAvg: true,
  ratingCount: true,
  isDemo: true,
  brand: { select: { name: true } },
  store: { select: { name: true, slug: true, isOfficial: true } },
  images: { take: 1, orderBy: { position: "asc" }, select: { url: true, alt: true } },
  variants: {
    where: { status: "ACTIVE" },
    orderBy: { position: "asc" },
    select: { id: true, priceCents: true, compareAtPriceCents: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

/**
 * Converte linhas do banco em ProductCardData com o preço EFETIVO calculado
 * pelo motor (as colunas desnormalizadas servem apenas para ordenar/filtrar).
 */
export async function toProductCards(rows: CardRow[], now: Date = new Date()): Promise<ProductCardData[]> {
  if (!rows.length) return [];
  const ancestors = await getCategoryAncestorsMap();
  const promotions = await loadActivePromotionsFor(
    rows.map((r) => ({ id: r.id, categoryId: r.categoryId, storeId: r.storeId })),
    ancestors,
    now,
  );
  return rows.map((r) => {
    const promos = promotions.get(r.id) ?? [];
    const priced = r.variants.map((v) => ({ stock: v.stock, id: v.id, eff: computeEffectivePrice(v, promos, now) }));
    const pool = priced.some((v) => v.stock > 0) ? priced.filter((v) => v.stock > 0) : priced;
    const best = pool.reduce<(typeof priced)[number] | null>((acc, v) => (!acc || v.eff.priceCents < acc.eff.priceCents ? v : acc), null);
    const promo = best?.eff.promotion ?? null;
    const defaultVariant = priced.find((v) => v.stock > 0) ?? null;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      imageUrl: r.images[0]?.url ?? null,
      imageAlt: r.images[0]?.alt ?? r.name,
      brandName: r.brand?.name ?? null,
      storeName: r.store.name,
      storeSlug: r.store.slug,
      isOfficial: r.store.isOfficial,
      condition: r.condition,
      priceCents: best?.eff.priceCents ?? 0,
      listPriceCents: best?.eff.listPriceCents ?? null,
      discountPercent: best?.eff.discountPercent ?? 0,
      freeShipping: r.freeShipping,
      totalStock: r.totalStock,
      salesCount: r.salesCount,
      ratingAvg: r.ratingAvg,
      ratingCount: r.ratingCount,
      promotion: promo
        ? { id: promo.id, name: promo.name, isFlash: promo.isFlash, endsAt: promo.endsAt.toISOString(), stockLimit: promo.stockLimit, soldCount: promo.soldCount }
        : null,
      variantCount: r.variants.length,
      defaultVariantId: r.variants.length === 1 ? (defaultVariant?.id ?? null) : null,
      isDemo: r.isDemo,
    };
  });
}

export async function getProductCards(args: { where?: Prisma.ProductWhereInput; orderBy?: Prisma.ProductOrderByWithRelationInput[]; take?: number; skip?: number }) {
  const rows = await db.product.findMany({
    where: { AND: [publicProductWhere, args.where ?? {}] },
    orderBy: [...(args.orderBy ?? [{ salesCount: "desc" }]), { id: "asc" }],
    take: Math.min(args.take ?? 12, 60),
    skip: args.skip,
    select: CARD_SELECT,
  });
  return toProductCards(rows);
}

/** Cards por ids (ex.: vistos recentemente), opcionalmente preservando a ordem pedida. */
export async function getProductCardsByIds(ids: string[], opts: { preserveOrder?: boolean; includeOutOfStock?: boolean } = {}) {
  const unique = [...new Set(ids)].slice(0, 60);
  if (!unique.length) return [];
  const rows = await db.product.findMany({
    where: { id: { in: unique }, status: { in: opts.includeOutOfStock === false ? ["ACTIVE"] : ["ACTIVE", "OUT_OF_STOCK"] }, store: { status: "ACTIVE" } },
    select: CARD_SELECT,
  });
  const cards = await toProductCards(rows);
  if (!opts.preserveOrder) return cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  return unique.map((id) => byId.get(id)).filter((c): c is ProductCardData => Boolean(c));
}
