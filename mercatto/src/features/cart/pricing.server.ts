import "server-only";
import { db, type Tx } from "@/server/db";
import { computeEffectivePrice, type CouponLine, type EffectivePrice } from "@/features/pricing/engine";
import { loadActivePromotionsFor } from "@/features/pricing/promotions.server";
import { getCategoryAncestorsMap } from "@/features/catalog/categories.server";
import { CART_MAX_QUANTITY_PER_ITEM } from "@/features/cart/types";

/**
 * Carrega variantes e calcula o preço EFETIVO atual de cada linha com o motor
 * de preços (promoções ativas agora). Usado por carrinho, frete e checkout —
 * nenhum valor monetário vem do navegador.
 */
export type LineRequest = { variantId: string; quantity: number; itemId?: string; selected?: boolean };

export type Availability = "AVAILABLE" | "INSUFFICIENT_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE";

export type PricedLine = {
  key: string;
  itemId: string | null;
  selected: boolean;
  variantId: string;
  variantName: string;
  optionValues: Record<string, string>;
  sku: string;
  productId: string;
  productName: string;
  productSlug: string;
  categoryId: string;
  categoryAncestorIds: string[];
  imageUrl: string | null;
  imageAlt: string;
  store: {
    id: string;
    name: string;
    slug: string;
    isOfficial: boolean;
    ownerId: string;
    originCep: string;
    originState: string | null;
  };
  quantity: number;
  stock: number;
  minStock: number;
  maxQuantity: number;
  price: EffectivePrice;
  unitPriceCents: number;
  lineTotalCents: number;
  /** Unidades restantes do estoque promocional (null = sem limite / sem promoção). */
  promotionRemaining: number | null;
  freeShipping: boolean;
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  availability: Availability;
  /** Mensagem amigável quando a linha não pode ser comprada como está. */
  availabilityMessage: string | null;
};

const VARIANT_SELECT = {
  id: true,
  sku: true,
  name: true,
  optionValues: true,
  priceCents: true,
  compareAtPriceCents: true,
  stock: true,
  minStock: true,
  status: true,
  weightGrams: true,
  image: { select: { url: true, alt: true } },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      storeId: true,
      categoryId: true,
      freeShipping: true,
      weightGrams: true,
      heightCm: true,
      widthCm: true,
      lengthCm: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          isOfficial: true,
          status: true,
          ownerId: true,
          originCep: true,
          originState: true,
        },
      },
    },
  },
} as const;

function toOptionValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number") out[k] = String(v);
  }
  return out;
}

export function stockMessage(stock: number, inCart = 0): string {
  if (stock <= 0) return "Produto esgotado.";
  const units = stock === 1 ? "1 unidade disponível" : `${stock} unidades disponíveis`;
  return inCart > 0 ? `Só temos ${units} (você já tem ${inCart} no carrinho).` : `Só temos ${units}.`;
}

export async function priceLines(requests: LineRequest[], opts: { now?: Date; tx?: Tx } = {}): Promise<PricedLine[]> {
  if (requests.length === 0) return [];
  const client = opts.tx ?? db;
  const now = opts.now ?? new Date();
  const variantIds = [...new Set(requests.map((r) => r.variantId))];
  const variants = await client.productVariant.findMany({ where: { id: { in: variantIds } }, select: VARIANT_SELECT });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const products = [...new Map(variants.map((v) => [v.product.id, v.product])).values()];
  const ancestors = await getCategoryAncestorsMap();
  const promotions = await loadActivePromotionsFor(
    products.map((p) => ({ id: p.id, categoryId: p.categoryId, storeId: p.storeId })),
    ancestors,
    now,
    opts.tx,
  );

  const lines: PricedLine[] = [];
  for (const req of requests) {
    const v = byId.get(req.variantId);
    if (!v) continue; // variante removida: o item some do carrinho (cascade) — nada a precificar
    const p = v.product;
    const price = computeEffectivePrice(
      { priceCents: v.priceCents, compareAtPriceCents: v.compareAtPriceCents },
      promotions.get(p.id) ?? [],
      now,
    );
    const promo = price.promotion;
    const promotionRemaining = promo && promo.stockLimit !== null ? Math.max(0, promo.stockLimit - promo.soldCount) : null;

    let availability: Availability = "AVAILABLE";
    let availabilityMessage: string | null = null;
    if (v.status !== "ACTIVE" || !["ACTIVE", "OUT_OF_STOCK"].includes(p.status) || p.store.status !== "ACTIVE") {
      availability = "UNAVAILABLE";
      availabilityMessage = "Este produto não está mais disponível.";
    } else if (v.stock <= 0) {
      availability = "OUT_OF_STOCK";
      availabilityMessage = "Produto esgotado.";
    } else if (req.quantity > v.stock) {
      availability = "INSUFFICIENT_STOCK";
      availabilityMessage = stockMessage(v.stock);
    }

    const image = v.image ?? p.images[0] ?? null;
    lines.push({
      key: v.id,
      itemId: req.itemId ?? null,
      selected: req.selected ?? true,
      variantId: v.id,
      variantName: v.name,
      optionValues: toOptionValues(v.optionValues),
      sku: v.sku,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      categoryId: p.categoryId,
      categoryAncestorIds: ancestors.get(p.categoryId) ?? [],
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? p.name,
      store: {
        id: p.store.id,
        name: p.store.name,
        slug: p.store.slug,
        isOfficial: p.store.isOfficial,
        ownerId: p.store.ownerId,
        originCep: p.store.originCep,
        originState: p.store.originState,
      },
      quantity: req.quantity,
      stock: v.stock,
      minStock: v.minStock,
      maxQuantity: Math.max(0, Math.min(CART_MAX_QUANTITY_PER_ITEM, v.stock)),
      price,
      unitPriceCents: price.priceCents,
      lineTotalCents: price.priceCents * req.quantity,
      promotionRemaining,
      freeShipping: p.freeShipping,
      weightGrams: v.weightGrams ?? p.weightGrams,
      heightCm: p.heightCm,
      widthCm: p.widthCm,
      lengthCm: p.lengthCm,
      availability,
      availabilityMessage,
    });
  }
  return lines;
}

/** Converte linhas precificadas para o formato do avaliador de cupons. */
export function toCouponLines(lines: PricedLine[]): CouponLine[] {
  return lines.map((l) => ({
    key: l.key,
    productId: l.productId,
    categoryId: l.categoryId,
    categoryAncestorIds: l.categoryAncestorIds,
    storeId: l.store.id,
    unitPriceCents: l.unitPriceCents,
    quantity: l.quantity,
    hasPromotion: Boolean(l.price.promotion),
  }));
}

/** Agrupa linhas por loja preservando a ordem de aparição. */
export function groupByStore<T extends { store: { id: string } }>(lines: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const list = groups.get(line.store.id);
    if (list) list.push(line);
    else groups.set(line.store.id, [line]);
  }
  return groups;
}
