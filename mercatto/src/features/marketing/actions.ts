"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireSeller } from "@/server/auth/guards";
import { campaignInputSchema, couponInputSchema, promotionInputSchema } from "@/features/marketing/schemas";
import {
  cancelPromotion,
  createCampaign,
  createCoupon,
  createPromotion,
  setCouponActive,
  updateCampaign,
  updateCoupon,
  updatePromotion,
  type MarketingScope,
} from "@/features/marketing/service";
import { searchSelectableProducts } from "@/features/marketing/queries";

const idSchema = z.object({ id: z.string().min(1).max(64) });

async function seller(): Promise<{ scope: MarketingScope; actorId: string }> {
  const user = await requireSeller();
  return { scope: { kind: "store", storeId: user.storeId }, actorId: user.id };
}

async function platform(): Promise<{ scope: MarketingScope; actorId: string }> {
  const user = await requirePermission("admin:marketing");
  return { scope: { kind: "platform" }, actorId: user.id };
}

function revalidateMarketing() {
  revalidatePath("/vendedor/promocoes");
  revalidatePath("/vendedor/cupons");
  revalidatePath("/admin/promocoes");
  revalidatePath("/admin/cupons");
  revalidatePath("/admin/campanhas");
  revalidatePath("/");
  revalidatePath("/ofertas");
}

// --- Vendedor ---------------------------------------------------------------

export const sellerCreatePromotionAction = createAction(promotionInputSchema, async (input) => {
  const { scope, actorId } = await seller();
  const promo = await createPromotion(scope, actorId, input);
  revalidateMarketing();
  return ok(promo, promo.status === "ACTIVE" ? "Promoção ativa!" : "Promoção agendada.");
}, "marketing.seller_create_promotion");

export const sellerUpdatePromotionAction = createAction(z.object({ id: z.string().min(1).max(64), input: promotionInputSchema }), async ({ id, input }) => {
  const { scope, actorId } = await seller();
  await updatePromotion(scope, actorId, id, input);
  revalidateMarketing();
  return ok(undefined, "Promoção atualizada.");
}, "marketing.seller_update_promotion");

export const sellerCancelPromotionAction = createAction(idSchema, async ({ id }) => {
  const { scope, actorId } = await seller();
  await cancelPromotion(scope, actorId, id);
  revalidateMarketing();
  return ok(undefined, "Promoção encerrada.");
}, "marketing.seller_cancel_promotion");

export const sellerCreateCouponAction = createAction(couponInputSchema, async (input) => {
  const { scope, actorId } = await seller();
  const coupon = await createCoupon(scope, actorId, input);
  revalidateMarketing();
  return ok(coupon, "Cupom criado.");
}, "marketing.seller_create_coupon");

export const sellerUpdateCouponAction = createAction(z.object({ id: z.string().min(1).max(64), input: couponInputSchema }), async ({ id, input }) => {
  const { scope, actorId } = await seller();
  await updateCoupon(scope, actorId, id, input);
  revalidateMarketing();
  return ok(undefined, "Cupom atualizado.");
}, "marketing.seller_update_coupon");

export const sellerToggleCouponAction = createAction(z.object({ id: z.string().min(1).max(64), isActive: z.boolean() }), async ({ id, isActive }) => {
  const { scope, actorId } = await seller();
  await setCouponActive(scope, actorId, id, isActive);
  revalidateMarketing();
  return ok(undefined, isActive ? "Cupom ativado." : "Cupom desativado.");
}, "marketing.seller_toggle_coupon");

export const sellerSearchProductsAction = createAction(z.object({ q: z.string().trim().max(80).default("") }), async ({ q }) => {
  const { scope } = await seller();
  return ok(await searchSelectableProducts(scope, q));
}, "marketing.seller_search_products");

// --- Plataforma (admin) -------------------------------------------------------

export const adminCreatePromotionAction = createAction(promotionInputSchema, async (input) => {
  const { scope, actorId } = await platform();
  const promo = await createPromotion(scope, actorId, input);
  revalidateMarketing();
  return ok(promo, promo.status === "ACTIVE" ? "Promoção ativa!" : "Promoção agendada.");
}, "marketing.admin_create_promotion");

export const adminUpdatePromotionAction = createAction(z.object({ id: z.string().min(1).max(64), input: promotionInputSchema }), async ({ id, input }) => {
  const { scope, actorId } = await platform();
  await updatePromotion(scope, actorId, id, input);
  revalidateMarketing();
  return ok(undefined, "Promoção atualizada.");
}, "marketing.admin_update_promotion");

/** Admin pode encerrar qualquer promoção (inclusive de lojas parceiras — moderação). */
export const adminCancelPromotionAction = createAction(idSchema, async ({ id }) => {
  const user = await requirePermission("admin:marketing");
  const { db } = await import("@/server/db");
  const promo = await db.promotion.findUnique({ where: { id }, select: { storeId: true } });
  const scope: MarketingScope = promo?.storeId ? { kind: "store", storeId: promo.storeId } : { kind: "platform" };
  await cancelPromotion(scope, user.id, id);
  revalidateMarketing();
  return ok(undefined, "Promoção encerrada.");
}, "marketing.admin_cancel_promotion");

export const adminCreateCouponAction = createAction(couponInputSchema, async (input) => {
  const { scope, actorId } = await platform();
  const coupon = await createCoupon(scope, actorId, input);
  revalidateMarketing();
  return ok(coupon, "Cupom criado.");
}, "marketing.admin_create_coupon");

export const adminUpdateCouponAction = createAction(z.object({ id: z.string().min(1).max(64), input: couponInputSchema }), async ({ id, input }) => {
  const { scope, actorId } = await platform();
  await updateCoupon(scope, actorId, id, input);
  revalidateMarketing();
  return ok(undefined, "Cupom atualizado.");
}, "marketing.admin_update_coupon");

/** Admin pode ativar/desativar qualquer cupom (inclusive de lojas parceiras). */
export const adminToggleCouponAction = createAction(z.object({ id: z.string().min(1).max(64), isActive: z.boolean() }), async ({ id, isActive }) => {
  const user = await requirePermission("admin:marketing");
  const { db } = await import("@/server/db");
  const coupon = await db.coupon.findUnique({ where: { id }, select: { storeId: true } });
  const scope: MarketingScope = coupon?.storeId ? { kind: "store", storeId: coupon.storeId } : { kind: "platform" };
  await setCouponActive(scope, user.id, id, isActive);
  revalidateMarketing();
  return ok(undefined, isActive ? "Cupom ativado." : "Cupom desativado.");
}, "marketing.admin_toggle_coupon");

export const adminSearchProductsAction = createAction(z.object({ q: z.string().trim().max(80).default("") }), async ({ q }) => {
  const { scope } = await platform();
  return ok(await searchSelectableProducts(scope, q));
}, "marketing.admin_search_products");

export const adminCreateCampaignAction = createAction(campaignInputSchema, async (input) => {
  const { actorId } = await platform();
  const campaign = await createCampaign(actorId, input);
  revalidateMarketing();
  return ok(campaign, "Campanha criada.");
}, "marketing.admin_create_campaign");

export const adminUpdateCampaignAction = createAction(z.object({ id: z.string().min(1).max(64), input: campaignInputSchema }), async ({ id, input }) => {
  const { actorId } = await platform();
  const campaign = await updateCampaign(actorId, id, input);
  revalidateMarketing();
  return ok(campaign, "Campanha atualizada.");
}, "marketing.admin_update_campaign");
