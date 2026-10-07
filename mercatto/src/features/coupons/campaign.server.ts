import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getProductCards, publicProductWhere } from "@/features/catalog/cards.server";
import { getCategoryTree } from "@/features/catalog/categories.server";
import { getStoreSettings } from "@/features/settings/queries";
import { describeCouponBenefit, getUserCouponContext, loadCouponForEvaluation, normalizeCouponCode, type LoadedCoupon } from "@/features/coupons/service";
import type { CategoryNode, ProductCardData } from "@/features/catalog/types";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";

/**
 * Campanhas de cupom exibidas na vitrine (pop-up de boas-vindas, faixas e a
 * página /cupom/[code]). TODA regra vem do cupom cadastrado no painel
 * (percentual, código, mínimo, teto, datas, produtos e categorias) — nada fica
 * escrito nos componentes. O desconto em si é sempre calculado e validado no
 * servidor (carrinho e checkout), nunca no navegador.
 */

export type CouponCampaignView = {
  code: string;
  /** "30% OFF" | "R$ 20,00 OFF" | "Frete grátis" */
  headline: string;
  percent: number | null;
  benefit: string;
  conditions: string[];
  endsAt: string | null;
  href: string;
  stackWithPromotions: boolean;
  /** Restrito a produtos/categorias ("produtos selecionados") ou válido na loja toda. */
  restricted: boolean;
};

export type WelcomeCampaignView = CouponCampaignView & { reshowDays: number };

function headlineOf(coupon: Pick<LoadedCoupon, "type" | "value">): string {
  if (coupon.type === "PERCENT") return `${coupon.value}% OFF`;
  if (coupon.type === "FIXED") return `${formatBRL(coupon.value)} OFF`;
  return "Frete grátis";
}

/** Condições legíveis, na ordem em que o cliente precisa delas. */
export function couponConditions(coupon: LoadedCoupon): string[] {
  const list: string[] = [];
  const restricted = coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
  list.push(restricted ? "Válido somente para os produtos participantes." : "Válido para os produtos da loja.");
  if (!coupon.stackWithPromotions) list.push("Não vale para produtos que já estão em promoção.");
  if (coupon.minOrderCents > 0) list.push(`Compras a partir de ${formatBRL(coupon.minOrderCents)}.`);
  if (coupon.maxDiscountCents !== null) list.push(`Desconto máximo de ${formatBRL(coupon.maxDiscountCents)} por compra.`);
  if (coupon.firstPurchaseOnly) list.push("Válido somente na primeira compra.");
  if (coupon.usageLimitPerUser !== null) list.push(coupon.usageLimitPerUser === 1 ? "Limite de 1 uso por cliente." : `Limite de ${coupon.usageLimitPerUser} usos por cliente.`);
  if (coupon.usageLimit !== null) list.push("Quantidade de usos limitada.");
  if (coupon.startsAt && coupon.startsAt > new Date()) list.push(`Válido a partir de ${formatDate(coupon.startsAt)}.`);
  if (coupon.endsAt) list.push(`Válido até ${formatDate(new Date(coupon.endsAt.getTime() - 1))}.`);
  list.push("O desconto é aplicado no carrinho e confirmado no checkout.");
  return list;
}

/** Cupom utilizável agora (ativo, dentro do período e com usos disponíveis). */
function isLive(coupon: LoadedCoupon, now = new Date()): boolean {
  if (!coupon.isActive) return false;
  if (coupon.startsAt && now < coupon.startsAt) return false;
  if (coupon.endsAt && now >= coupon.endsAt) return false;
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return false;
  return true;
}

function descendantIds(tree: CategoryNode[], roots: string[]): string[] {
  const wanted = new Set(roots);
  const out = new Set<string>();
  const walk = (nodes: CategoryNode[], inside: boolean) => {
    for (const n of nodes) {
      const hit = inside || wanted.has(n.id);
      if (hit) out.add(n.id);
      walk(n.children, hit);
    }
  };
  walk(tree, false);
  for (const id of roots) out.add(id); // categorias inativas/fora da árvore continuam valendo
  return [...out];
}

/**
 * Filtro de produtos elegíveis — espelha o motor de preços (evaluateCoupon):
 * produto listado OU categoria (com subcategorias), loja do cupom e, se o
 * cupom não acumula, só produtos sem promoção ativa.
 */
async function eligibleWhere(coupon: LoadedCoupon): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [];
  if (coupon.productIds.length || coupon.categoryIds.length) {
    const categories = coupon.categoryIds.length ? descendantIds(await getCategoryTree(), coupon.categoryIds) : [];
    and.push({ OR: [...(coupon.productIds.length ? [{ id: { in: coupon.productIds } }] : []), ...(categories.length ? [{ categoryId: { in: categories } }] : [])] });
  }
  if (coupon.storeId) and.push({ storeId: coupon.storeId });
  if (!coupon.stackWithPromotions) and.push({ hasActivePromotion: false });
  return { AND: and };
}

/** Quantos produtos publicados participam (número real, sem o limite da vitrine). */
async function countEligibleProducts(coupon: LoadedCoupon): Promise<number> {
  return db.product.count({ where: { AND: [publicProductWhere, await eligibleWhere(coupon)] } });
}

/**
 * Motivo pelo qual o cliente logado não pode usar o cupom (limite por cliente
 * ou "só na primeira compra") — o mesmo histórico que o checkout consulta.
 */
export async function couponBlockedForUser(coupon: LoadedCoupon, userId: string | null): Promise<string | null> {
  if (!userId || (coupon.usageLimitPerUser === null && !coupon.firstPurchaseOnly)) return null;
  const ctx = await getUserCouponContext(userId, coupon.id);
  if (coupon.usageLimitPerUser !== null && ctx.userUsageCount >= coupon.usageLimitPerUser) return "Você já utilizou este cupom o máximo de vezes permitido.";
  if (coupon.firstPurchaseOnly && ctx.userCompletedOrders > 0) return "Este cupom é válido somente na primeira compra.";
  return null;
}

/** Produtos participantes (cards prontos), já sem os que o motor recusaria. */
export async function getEligibleProducts(coupon: LoadedCoupon, take = 48): Promise<ProductCardData[]> {
  const cards = await getProductCards({ where: await eligibleWhere(coupon), orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }], take });
  return coupon.stackWithPromotions ? cards : cards.filter((c) => c.promotion === null);
}

function toView(coupon: LoadedCoupon): CouponCampaignView {
  return {
    code: coupon.code,
    headline: headlineOf(coupon),
    percent: coupon.type === "PERCENT" ? coupon.value : null,
    benefit: describeCouponBenefit(coupon),
    conditions: couponConditions(coupon),
    endsAt: coupon.endsAt?.toISOString() ?? null,
    href: `/cupom/${encodeURIComponent(coupon.code)}`,
    stackWithPromotions: coupon.stackWithPromotions,
    restricted: coupon.productIds.length > 0 || coupon.categoryIds.length > 0,
  };
}

const loadWelcomeCampaign = cache(async (): Promise<{ coupon: LoadedCoupon; view: WelcomeCampaignView } | null> => {
  const settings = await getStoreSettings();
  if (!settings.welcomeCouponCode) return null;
  const coupon = await loadCouponForEvaluation(settings.welcomeCouponCode);
  if (!coupon || coupon.storeId || !isLive(coupon)) return null;
  if (!coupon.productIds.length && !coupon.categoryIds.length) return null;
  // Amostra (não 1 só): um card pode sair do filtro de promoção ativa.
  const sample = await getEligibleProducts(coupon, 12);
  if (!sample.length) return null;
  return { coupon, view: { ...toView(coupon), reshowDays: settings.welcomeCouponReshowDays } };
});

/**
 * Campanha de boas-vindas (configurada em Admin → Configurações). Só existe
 * quando o cupom está ativo, é da plataforma, restringe produtos/categorias
 * ("produtos selecionados") e há ao menos um produto participante à venda —
 * assim o pop-up nunca promete um desconto que não pode ser usado. Para o
 * cliente logado que já não pode usar o cupom (limite/primeira compra), some.
 */
export const getWelcomeCampaign = cache(async (userId: string | null): Promise<WelcomeCampaignView | null> => {
  const found = await loadWelcomeCampaign();
  if (!found || (await couponBlockedForUser(found.coupon, userId))) return null;
  return found.view;
});

export type CouponLanding = {
  campaign: CouponCampaignView;
  status: "live" | "scheduled" | "ended";
  startsAt: string | null;
  products: ProductCardData[];
  total: number;
};

/**
 * Página pública do cupom: só cupons ativos e públicos (ou o de boas-vindas)
 * da plataforma. Cupom desativado (rascunho) não tem página.
 */
export async function getCouponLanding(rawCode: string): Promise<CouponLanding | null> {
  const code = normalizeCouponCode(rawCode);
  const [coupon, settings] = await Promise.all([loadCouponForEvaluation(code), getStoreSettings()]);
  if (!coupon || coupon.storeId || !coupon.isActive) return null;
  if (!coupon.isPublic && coupon.code !== settings.welcomeCouponCode) return null;
  const startsAt = coupon.startsAt?.toISOString() ?? null;
  if (coupon.startsAt && coupon.startsAt > new Date()) return { campaign: toView(coupon), status: "scheduled", startsAt, products: [], total: 0 };
  if (!isLive(coupon)) return { campaign: toView(coupon), status: "ended", startsAt, products: [], total: 0 };
  const [products, total] = await Promise.all([getEligibleProducts(coupon), countEligibleProducts(coupon)]);
  return { campaign: toView(coupon), status: "live", startsAt, products, total: Math.max(total, products.length) };
}

/** Cupom que pode ser ativado direto da vitrine (pop-up/página do cupom). */
export async function findPromotableCoupon(rawCode: string): Promise<LoadedCoupon | null> {
  const code = normalizeCouponCode(rawCode);
  const [coupon, settings] = await Promise.all([loadCouponForEvaluation(code), getStoreSettings()]);
  if (!coupon || coupon.storeId || !isLive(coupon)) return null;
  if (!coupon.isPublic && coupon.code !== settings.welcomeCouponCode) return null;
  return coupon;
}

export type WelcomeCampaignStatus = { code: string | null; visible: boolean; eligibleCount: number; message: string; couponId: string | null };

/** Diagnóstico para o painel: a campanha aparece? Se não, por quê. */
export async function getWelcomeCampaignStatus(): Promise<WelcomeCampaignStatus> {
  const settings = await getStoreSettings();
  const code = settings.welcomeCouponCode;
  if (!code) return { code: null, visible: false, eligibleCount: 0, couponId: null, message: "Campanha desligada (nenhum cupom definido)." };
  const coupon = await loadCouponForEvaluation(code);
  if (!coupon) return { code, visible: false, eligibleCount: 0, couponId: null, message: `O cupom ${code} não existe. Crie-o em Cupons.` };
  const base = { code, couponId: coupon.id };
  if (coupon.storeId) return { ...base, visible: false, eligibleCount: 0, message: "Use um cupom da plataforma (não de vendedor)." };
  if (!coupon.productIds.length && !coupon.categoryIds.length) return { ...base, visible: false, eligibleCount: 0, message: "Escolha os produtos ou categorias participantes no cupom." };
  const eligibleCount = await countEligibleProducts(coupon);
  if (!isLive(coupon)) return { ...base, visible: false, eligibleCount, message: coupon.isActive ? "O cupom está fora do período de validade ou sem usos disponíveis." : "O cupom está inativo. Ative-o em Cupons." };
  if (!eligibleCount) return { ...base, visible: false, eligibleCount, message: "Nenhum produto participante está publicado no momento." };
  return { ...base, visible: true, eligibleCount, message: `Campanha no ar com ${eligibleCount} ${eligibleCount === 1 ? "produto participante" : "produtos participantes"}.` };
}
