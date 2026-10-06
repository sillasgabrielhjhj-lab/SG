import "server-only";
import { db, type Tx } from "@/server/db";
import { normalizeText } from "@/lib/utils";
import { computeEffectivePrice } from "@/features/pricing/engine";
import { loadActivePromotionsFor } from "@/features/pricing/promotions.server";
import { getAllCategories, getCategoryAncestorsMap } from "@/features/catalog/categories.server";

/**
 * Recalcula os campos desnormalizados do produto usados em listagem, busca
 * e ordenação: preço mínimo, preço efetivo (com promoção ativa), desconto,
 * estoque total, avaliações e texto de busca. Também alterna automaticamente
 * ACTIVE <-> OUT_OF_STOCK conforme o estoque.
 *
 * Deve ser chamado após QUALQUER alteração em variantes, estoque, preço,
 * promoções, avaliações ou dados textuais do produto.
 */
export async function recomputeProductAggregates(productIds: string[], tx?: Tx) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (ids.length === 0) return;
  const client = tx ?? db;
  const now = new Date();

  const products = await client.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      sku: true,
      gtin: true,
      tags: true,
      status: true,
      storeId: true,
      categoryId: true,
      shortDescription: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      store: { select: { name: true } },
      variants: {
        where: { status: "ACTIVE" },
        select: { sku: true, name: true, priceCents: true, compareAtPriceCents: true, stock: true },
      },
      attributes: { select: { value: true } },
    },
  });

  const ancestors = await getCategoryAncestorsMap();
  const categoryNames = new Map((await getAllCategories()).map((c) => [c.id, c.name]));
  const promotions = await loadActivePromotionsFor(products, ancestors, now, tx);

  const ratings = await client.review.groupBy({
    by: ["productId"],
    where: { productId: { in: ids }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.productId, r]));

  for (const p of products) {
    const promos = promotions.get(p.id) ?? [];
    // Só variações com preço definido entram em preço e estoque (sem preço = não vendável).
    const priced = p.variants.filter((v) => v.priceCents > 0).map((v) => ({ stock: v.stock, base: v.priceCents, eff: computeEffectivePrice(v, promos, now) }));
    const totalStock = priced.reduce((sum, v) => sum + v.stock, 0);
    const minBase = priced.length ? Math.min(...priced.map((v) => v.base)) : 0;
    const maxBase = priced.length ? Math.max(...priced.map((v) => v.base)) : 0;
    // Preço exibido: a variante mais barata COM estoque (ou a mais barata, se nenhuma tiver).
    const pool = priced.some((v) => v.stock > 0) ? priced.filter((v) => v.stock > 0) : priced;
    const best = pool.reduce<(typeof priced)[number]["eff"] | null>(
      (acc, v) => (!acc || v.eff.priceCents < acc.priceCents ? v.eff : acc),
      null,
    );

    const searchText = normalizeText(
      [
        p.name,
        p.brand?.name,
        p.category.name,
        // Categorias ancestrais ("Celulares" para um produto em "Smartphones").
        ...(ancestors.get(p.categoryId) ?? []).map((id) => categoryNames.get(id)),
        p.store.name,
        p.sku,
        p.gtin,
        p.shortDescription,
        ...p.tags,
        ...p.variants.flatMap((v) => [v.sku, v.name]),
        ...p.attributes.map((a) => a.value),
      ]
        .filter(Boolean)
        .join(" "),
    ).slice(0, 4000);

    let status = p.status;
    if (status === "ACTIVE" && totalStock <= 0) status = "OUT_OF_STOCK";
    else if (status === "OUT_OF_STOCK" && totalStock > 0) status = "ACTIVE";

    const rating = ratingMap.get(p.id);
    await client.product.update({
      where: { id: p.id },
      data: {
        minPriceCents: minBase,
        maxPriceCents: maxBase,
        effectivePriceCents: best?.priceCents ?? minBase,
        compareAtPriceCents: best?.listPriceCents ?? null,
        discountPercent: best?.discountPercent ?? 0,
        hasActivePromotion: Boolean(best?.promotion),
        totalStock,
        status,
        searchText,
        ratingAvg: rating?._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : 0,
        ratingCount: rating?._count._all ?? 0,
      },
    });
  }
}
