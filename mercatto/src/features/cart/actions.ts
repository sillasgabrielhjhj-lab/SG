"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok, runAction } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { db } from "@/server/db";
import { normalizeCouponCode } from "@/features/coupons/service";
import { validateCouponForLines } from "@/features/coupons/service";
import { priceLines, toCouponLines } from "@/features/cart/pricing.server";
import { getCartView } from "@/features/cart/queries";
import {
  addItem,
  getCartCount,
  getCartIdentity,
  moveToWishlist,
  removeItem,
  setCartCoupon,
  setSelected,
  updateQuantity,
} from "@/features/cart/service";
import { AppError } from "@/server/errors";

const qty = z.coerce.number().int().min(1).max(99);
const itemId = z.string().min(1).max(64);

function revalidateCart() {
  revalidatePath("/carrinho");
}

async function limit(key: string) {
  await enforceRateLimit(`cart:${key}:${await getClientIp()}`, 120, 60);
}

export const addToCartAction = createAction(z.object({ variantId: z.string().min(1).max(64), quantity: qty.default(1) }), async ({ variantId, quantity }) => {
  await limit("add");
  const identity = (await getCartIdentity({ create: true }))!;
  const result = await addItem(identity, variantId, quantity);
  // Métrica de funil (adição ao carrinho) — melhor esforço.
  const today = new Date(new Date().toISOString().slice(0, 10));
  await db.productDailyStat
    .upsert({
      where: { productId_day: { productId: result.line.productId, day: today } },
      update: { addToCart: { increment: 1 } },
      create: { productId: result.line.productId, day: today, addToCart: 1 },
    })
    .catch(() => undefined);
  revalidateCart();
  return ok(
    {
      count: result.count,
      line: {
        productName: result.line.productName,
        variantName: result.line.variantName,
        imageUrl: result.line.imageUrl,
        unitPriceCents: result.line.unitPriceCents,
        quantity: result.quantity,
        productSlug: result.line.productSlug,
      },
    },
    "Produto adicionado ao carrinho",
  );
}, "cart.add");

export const updateCartItemAction = createAction(z.object({ itemId, quantity: z.coerce.number().int().min(0).max(99) }), async ({ itemId, quantity }) => {
  await limit("update");
  const identity = await getCartIdentity({ create: false });
  if (!identity) throw new AppError("NOT_FOUND", "Carrinho não encontrado.");
  const result = await updateQuantity(identity, itemId, quantity);
  revalidateCart();
  return ok(result);
}, "cart.update");

export const removeCartItemAction = createAction(z.object({ itemId }), async ({ itemId }) => {
  const identity = await getCartIdentity({ create: false });
  if (!identity) throw new AppError("NOT_FOUND", "Carrinho não encontrado.");
  const result = await removeItem(identity, itemId);
  revalidateCart();
  return ok(result, "Produto removido do carrinho");
}, "cart.remove");

export const toggleCartItemSelectionAction = createAction(
  z.object({ itemIds: z.union([z.literal("all"), z.array(itemId).max(50)]), selected: z.boolean() }),
  async ({ itemIds, selected }) => {
    const identity = await getCartIdentity({ create: false });
    if (!identity) return ok(undefined);
    await setSelected(identity, itemIds, selected);
    revalidateCart();
    return ok(undefined);
  },
  "cart.select",
);

export const applyCouponAction = createAction(z.object({ code: z.string().trim().min(2).max(40) }), async ({ code }) => {
  await enforceRateLimit(`coupon:${await getClientIp()}`, 20, 10 * 60);
  const identity = (await getCartIdentity({ create: true }))!;
  const normalized = normalizeCouponCode(code);
  const cart = await db.cart.findUnique({
    where: identity.userId ? { userId: identity.userId } : { guestToken: identity.guestTokenHash },
    select: { items: { where: { selected: true }, select: { variantId: true, quantity: true } } },
  });
  const lines = (await priceLines(cart?.items ?? [])).filter((l) => l.availability === "AVAILABLE");
  if (!lines.length) throw new AppError("UNPROCESSABLE", "Adicione produtos ao carrinho para usar um cupom.");
  const result = await validateCouponForLines({ code: normalized, userId: identity.userId ?? null, lines: toCouponLines(lines), shippingCents: 0 });
  if (!result.ok) throw new AppError("UNPROCESSABLE", result.reason);
  await setCartCoupon(identity, result.coupon.code);
  revalidateCart();
  return ok({ code: result.coupon.code }, result.coupon.type === "FREE_SHIPPING" ? "Cupom de frete grátis aplicado!" : "Cupom aplicado!");
}, "cart.coupon");

export async function removeCouponAction() {
  return runAction(async () => {
    const identity = await getCartIdentity({ create: false });
    if (identity) await setCartCoupon(identity, null);
    revalidateCart();
    return ok(undefined, "Cupom removido");
  }, "cart.coupon_remove");
}

export const moveToWishlistAction = createAction(z.object({ itemId }), async ({ itemId }) => {
  const user = await requireUser();
  const result = await moveToWishlist(user.id, itemId);
  revalidateCart();
  return ok(result, "Movido para os favoritos");
}, "cart.move_to_wishlist");

/** Resumo leve para o mini-carrinho (drawer). */
export async function getMiniCartAction() {
  return runAction(async () => {
    const identity = await getCartIdentity({ create: false });
    const view = await getCartView(identity);
    return ok({
      count: view.count,
      subtotalCents: view.totals.subtotalCents,
      lines: view.groups.flatMap((g) =>
        g.lines.map((l) => ({
          itemId: l.itemId,
          productName: l.productName,
          productSlug: l.productSlug,
          variantName: l.variantName,
          imageUrl: l.imageUrl,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          status: l.status,
          storeName: g.store.name,
        })),
      ),
    });
  }, "cart.mini");
}

export async function getCartCountAction() {
  return runAction(async () => ok({ count: await getCartCount(await getCartIdentity({ create: false })) }), "cart.count");
}
