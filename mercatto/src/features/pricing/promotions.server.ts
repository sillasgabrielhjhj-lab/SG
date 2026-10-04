import "server-only";
import { db, type Tx } from "@/server/db";
import type { PricingPromotion } from "@/features/pricing/engine";

const PROMO_SELECT = {
  id: true,
  name: true,
  type: true,
  value: true,
  startsAt: true,
  endsAt: true,
  isFlash: true,
  priority: true,
  stockLimit: true,
  soldCount: true,
  perCustomerLimit: true,
  status: true,
  storeId: true,
  categoryIds: true,
  items: { select: { productId: true } },
} as const;

type ProductRef = { id: string; categoryId: string; storeId: string };

/**
 * Carrega as promoções ATIVAS (agora) aplicáveis a cada produto:
 *  - por item explícito (PromotionItem), ou
 *  - por categoria (incluindo categorias ancestrais).
 * Promoções de loja (storeId) só valem para produtos daquela loja.
 */
export async function loadActivePromotionsFor(
  products: ProductRef[],
  ancestors: Map<string, string[]>,
  now: Date = new Date(),
  tx?: Tx,
): Promise<Map<string, PricingPromotion[]>> {
  const result = new Map<string, PricingPromotion[]>(products.map((p) => [p.id, []]));
  if (products.length === 0) return result;
  const client = tx ?? db;
  const productIds = products.map((p) => p.id);
  const categoryIds = [...new Set(products.flatMap((p) => [p.categoryId, ...(ancestors.get(p.categoryId) ?? [])]))];

  const promos = await client.promotion.findMany({
    where: {
      status: { in: ["ACTIVE", "SCHEDULED"] },
      startsAt: { lte: now },
      endsAt: { gt: now },
      OR: [{ items: { some: { productId: { in: productIds } } } }, { categoryIds: { hasSome: categoryIds } }],
    },
    select: PROMO_SELECT,
  });

  for (const promo of promos) {
    const itemIds = new Set(promo.items.map((i) => i.productId));
    for (const product of products) {
      if (promo.storeId && promo.storeId !== product.storeId) continue;
      const productCats = [product.categoryId, ...(ancestors.get(product.categoryId) ?? [])];
      const applies = itemIds.has(product.id) || promo.categoryIds.some((c) => productCats.includes(c));
      if (!applies) continue;
      result.get(product.id)!.push({
        id: promo.id,
        name: promo.name,
        type: promo.type,
        value: promo.value,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        isFlash: promo.isFlash,
        priority: promo.priority,
        stockLimit: promo.stockLimit,
        soldCount: promo.soldCount,
        perCustomerLimit: promo.perCustomerLimit,
        // Estado efetivo calculado pelas datas (o status persistido pode estar defasado).
        status: "ACTIVE",
      });
    }
  }
  return result;
}
