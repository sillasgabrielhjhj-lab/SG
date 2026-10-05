import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { isAppError } from "@/server/errors";
import { getAllCategories } from "@/features/catalog/categories.server";
import { getCampaign, listCampaigns, type getCouponForEdit, type getPromotionForEdit } from "@/features/marketing/queries";
import type { MarketingScope } from "@/features/marketing/service";
import { toLocalInputValue } from "@/lib/dates";
import type { CategoryOption, PickedProduct } from "@/features/marketing/components/target-pickers";
import type { PromotionFormInitial } from "@/features/marketing/components/promotion-form";
import type { CouponFormInitial } from "@/features/marketing/components/coupon-form";
import type { CampaignFormInitial } from "@/features/marketing/components/campaign-form";

/** Dados auxiliares (somente servidor) para as rotas finas de marketing. */

/** Converte AppError NOT_FOUND em 404 da rota. */
export function orNotFound<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
}

/** Converte AppError NOT_FOUND em null (ex.: duplicar a partir de um id inválido). */
export function orNull<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") return null;
    throw e;
  });
}

/** Categorias ativas em ordem de árvore, com profundidade e caminho. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const all = await getAllCategories();
  const ids = new Set(all.map((c) => c.id));
  const children = new Map<string | null, typeof all>();
  for (const c of all) {
    const parent = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), c]);
  }
  const out: CategoryOption[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const c of children.get(parentId) ?? []) {
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ id: c.id, name: c.name, depth, path });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

/** Campanhas para o select do admin (inclui a já vinculada, mesmo antiga). */
export async function getCampaignOptions(includeId?: string | null) {
  const { items } = await listCampaigns(1);
  const options = items.map((c) => ({ id: c.id, name: c.name }));
  if (includeId && !options.some((c) => c.id === includeId)) {
    const extra = await getCampaign(includeId).catch(() => null);
    if (extra) options.push({ id: extra.id, name: extra.name });
  }
  return options;
}

/** Período padrão de formulários: agora → +N dias (horário de Brasília). */
export function defaultPeriod(days = 7, now = new Date()) {
  return { startsAt: toLocalInputValue(now), endsAt: toLocalInputValue(new Date(now.getTime() + days * 24 * 3600_000)) };
}

/** Dono (loja ou plataforma) de uma promoção/cupom — usado pelo admin para abrir itens de lojas em modo leitura. */
export async function resolveMarketingOwner(kind: "promotion" | "coupon", id: string): Promise<{ scope: MarketingScope; storeName: string | null } | null> {
  const row =
    kind === "promotion"
      ? await db.promotion.findUnique({ where: { id }, select: { storeId: true, store: { select: { name: true } } } })
      : await db.coupon.findUnique({ where: { id }, select: { storeId: true, store: { select: { name: true } } } });
  if (!row) return null;
  return { scope: row.storeId ? { kind: "store", storeId: row.storeId } : { kind: "platform" }, storeName: row.store?.name ?? null };
}

/** Produtos (chips) a partir de ids — restrito à loja quando informada. */
export async function getProductChips(ids: string[], storeId?: string | null): Promise<PickedProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, ...(storeId ? { storeId } : {}) },
    select: { id: true, name: true, sku: true, minPriceCents: true, status: true, store: { select: { name: true } }, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
  });
  const byId = new Map(rows.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p) => p !== undefined)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku, minPriceCents: p.minPriceCents, status: p.status, storeName: p.store.name, imageUrl: p.images[0]?.url ?? null }));
}

export function emptyPromotionInitial(period = defaultPeriod()): PromotionFormInitial {
  return { name: "", type: "PERCENT_OFF", value: null, isFlash: false, ...period, products: [], categoryIds: [], stockLimit: null, perCustomerLimit: null, priority: 0, campaignId: null };
}

export function emptyCouponInitial(): CouponFormInitial {
  return {
    code: "",
    description: "",
    type: "PERCENT",
    value: null,
    maxDiscountCents: null,
    minOrderCents: 0,
    startsAt: "",
    endsAt: "",
    usageLimit: null,
    usageLimitPerUser: 1,
    firstPurchaseOnly: false,
    stackWithPromotions: false,
    products: [],
    categoryIds: [],
    isActive: true,
    isPublic: false,
  };
}

type PromotionForEdit = Awaited<ReturnType<typeof getPromotionForEdit>>;

export function toPromotionInitial(p: PromotionForEdit, period?: { startsAt: string; endsAt: string }): PromotionFormInitial {
  return {
    name: p.name,
    type: p.type,
    value: p.value,
    isFlash: p.isFlash,
    startsAt: period?.startsAt ?? toLocalInputValue(p.startsAt),
    endsAt: period?.endsAt ?? toLocalInputValue(p.endsAt),
    products: p.products.map((x) => ({ id: x.id, name: x.name, sku: x.sku, minPriceCents: x.minPriceCents, imageUrl: x.images[0]?.url ?? null })),
    categoryIds: p.categoryIds,
    stockLimit: p.stockLimit,
    perCustomerLimit: p.perCustomerLimit,
    priority: p.priority,
    campaignId: p.campaignId,
  };
}

type CouponForEdit = Awaited<ReturnType<typeof getCouponForEdit>>;

export async function toCouponInitial(c: CouponForEdit): Promise<CouponFormInitial> {
  return {
    code: c.code,
    description: c.description ?? "",
    type: c.type,
    value: c.value,
    maxDiscountCents: c.maxDiscountCents,
    minOrderCents: c.minOrderCents,
    startsAt: toLocalInputValue(c.startsAt),
    endsAt: toLocalInputValue(c.endsAt),
    usageLimit: c.usageLimit,
    usageLimitPerUser: c.usageLimitPerUser,
    firstPurchaseOnly: c.firstPurchaseOnly,
    stackWithPromotions: c.stackWithPromotions,
    products: await getProductChips(c.productIds, c.storeId),
    categoryIds: c.categoryIds,
    isActive: c.isActive,
    isPublic: c.isPublic,
  };
}

type CampaignForEdit = Awaited<ReturnType<typeof getCampaign>>;

export function emptyCampaignInitial(period = defaultPeriod()): CampaignFormInitial {
  return { name: "", slug: "", description: "", bannerUrl: "", themeColor: "", ...period, isActive: true };
}

export function toCampaignInitial(c: CampaignForEdit): CampaignFormInitial {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    bannerUrl: c.bannerUrl ?? "",
    themeColor: c.themeColor ?? "",
    startsAt: toLocalInputValue(c.startsAt),
    endsAt: toLocalInputValue(c.endsAt),
    isActive: c.isActive,
  };
}

export function countCampaignPromotions(campaignId: string) {
  return db.promotion.count({ where: { campaignId } });
}
