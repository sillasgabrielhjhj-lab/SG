import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { getSession } from "@/server/auth/session";
import { clearGuestCartCookie, ensureGuestCartTokenHash, getGuestCartTokenHash } from "@/features/cart/cookie";
import { priceLines, stockMessage } from "@/features/cart/pricing.server";
import { CART_MAX_DISTINCT_ITEMS, CART_MAX_QUANTITY_PER_ITEM, type CartIdentity } from "@/features/cart/types";

/**
 * Serviço do carrinho. Toda validação de disponibilidade usa os dados ATUAIS
 * do banco (variante/produto/loja ativos, estoque). Preços nunca são
 * armazenados no carrinho — são sempre recalculados na leitura e no checkout.
 */

/** Identidade do carrinho atual (usuário logado ou visitante via cookie). */
export async function getCartIdentity(opts: { create: boolean }): Promise<CartIdentity | null> {
  const session = await getSession();
  if (session) return { userId: session.user.id };
  const hash = opts.create ? await ensureGuestCartTokenHash() : await getGuestCartTokenHash();
  return hash ? { guestTokenHash: hash } : null;
}

const cartWhere = (identity: CartIdentity): Prisma.CartWhereUniqueInput =>
  identity.userId ? { userId: identity.userId } : { guestToken: identity.guestTokenHash! };

export async function findCart(identity: CartIdentity) {
  return db.cart.findUnique({ where: cartWhere(identity), select: { id: true, couponCode: true } });
}

async function getOrCreateCart(identity: CartIdentity) {
  const existing = await findCart(identity);
  if (existing) return existing;
  try {
    return await db.cart.create({
      data: identity.userId ? { userId: identity.userId } : { guestToken: identity.guestTokenHash! },
      select: { id: true, couponCode: true },
    });
  } catch (error) {
    // Criação concorrente (duas abas): reaproveita o carrinho criado.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const cart = await findCart(identity);
      if (cart) return cart;
    }
    throw error;
  }
}

export async function getCartCount(identity: CartIdentity | null): Promise<number> {
  if (!identity) return 0;
  const agg = await db.cartItem.aggregate({ where: { cart: cartWhere(identity) }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

/** Valida que a variante pode ser comprada na quantidade pedida. */
async function assertPurchasable(variantId: string, quantity: number) {
  const [line] = await priceLines([{ variantId, quantity }]);
  if (!line) throw notFound("Produto não encontrado.");
  if (line.availability === "UNAVAILABLE" || line.availability === "OUT_OF_STOCK") {
    throw new AppError("OUT_OF_STOCK", line.availabilityMessage ?? "Este produto está indisponível no momento.");
  }
  if (quantity > line.maxQuantity) {
    throw new AppError("OUT_OF_STOCK", line.stock < CART_MAX_QUANTITY_PER_ITEM ? stockMessage(line.stock) : `Limite de ${CART_MAX_QUANTITY_PER_ITEM} unidades por item.`);
  }
  return line;
}

export async function addItem(identity: CartIdentity, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("VALIDATION", "Quantidade inválida.");
  const cart = await getOrCreateCart(identity);
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } }, select: { quantity: true } });
  if (!existing) {
    const distinct = await db.cartItem.count({ where: { cartId: cart.id } });
    if (distinct >= CART_MAX_DISTINCT_ITEMS) throw new AppError("UNPROCESSABLE", `Seu carrinho pode ter até ${CART_MAX_DISTINCT_ITEMS} produtos diferentes.`);
  }
  const desired = (existing?.quantity ?? 0) + quantity;
  const line = await assertPurchasable(variantId, desired);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: desired, selected: true },
    create: { cartId: cart.id, variantId, quantity: desired },
  });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return { line, quantity: desired, count: await getCartCount(identity) };
}

async function loadOwnedItem(identity: CartIdentity, itemId: string) {
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: cartWhere(identity) }, select: { id: true, variantId: true, cartId: true } });
  if (!item) throw notFound("Item não encontrado no carrinho.");
  return item;
}

export async function updateQuantity(identity: CartIdentity, itemId: string, quantity: number) {
  const item = await loadOwnedItem(identity, itemId);
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return { count: await getCartCount(identity) };
  }
  await assertPurchasable(item.variantId, quantity);
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return { count: await getCartCount(identity) };
}

export async function removeItem(identity: CartIdentity, itemId: string) {
  const item = await loadOwnedItem(identity, itemId);
  await db.cartItem.delete({ where: { id: item.id } });
  return { count: await getCartCount(identity) };
}

export async function setSelected(identity: CartIdentity, itemIds: string[] | "all", selected: boolean) {
  await db.cartItem.updateMany({
    where: { cart: cartWhere(identity), ...(itemIds === "all" ? {} : { id: { in: itemIds } }) },
    data: { selected },
  });
}

/** "Salvar para depois": move o item para os favoritos (exige login). */
export async function moveToWishlist(userId: string, itemId: string) {
  const item = await loadOwnedItem({ userId }, itemId);
  const variant = await db.productVariant.findUnique({ where: { id: item.variantId }, select: { productId: true } });
  await db.$transaction(async (tx) => {
    if (variant) {
      await tx.wishlistItem.upsert({
        where: { userId_productId: { userId, productId: variant.productId } },
        update: {},
        create: { userId, productId: variant.productId },
      });
    }
    await tx.cartItem.delete({ where: { id: item.id } });
  });
  return { count: await getCartCount({ userId }) };
}

export async function setCartCoupon(identity: CartIdentity, code: string | null) {
  const cart = await getOrCreateCart(identity);
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
}

/** Remove do carrinho as variantes compradas (após criar o checkout). */
export async function removePurchasedItems(userId: string, variantIds: string[]) {
  if (!variantIds.length) return;
  await db.cartItem.deleteMany({ where: { cart: { userId }, variantId: { in: variantIds } } });
  await db.cart.updateMany({ where: { userId }, data: { couponCode: null } });
}

/**
 * Mescla o carrinho de visitante no carrinho do usuário (após login/cadastro):
 * soma quantidades limitadas ao estoque e ao máximo por item; remove o
 * carrinho anônimo e o cookie.
 */
export async function mergeGuestCartOnLogin(userId: string) {
  const guestHash = await getGuestCartTokenHash();
  if (!guestHash) return;
  const guest = await db.cart.findUnique({ where: { guestToken: guestHash }, select: { id: true, couponCode: true, items: { select: { variantId: true, quantity: true } } } });
  if (!guest) {
    await clearGuestCartCookie().catch(() => undefined);
    return;
  }
  const userCart = await getOrCreateCart({ userId });
  const existing = await db.cartItem.findMany({ where: { cartId: userCart.id }, select: { variantId: true, quantity: true } });
  const current = new Map(existing.map((i) => [i.variantId, i.quantity]));
  const priced = await priceLines(guest.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity + (current.get(i.variantId) ?? 0) })));

  await db.$transaction(async (tx) => {
    for (const line of priced) {
      if (line.availability === "UNAVAILABLE" || line.availability === "OUT_OF_STOCK") continue;
      const quantity = Math.min(line.quantity, line.maxQuantity);
      if (quantity < 1) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: line.variantId } },
        update: { quantity },
        create: { cartId: userCart.id, variantId: line.variantId, quantity },
      });
    }
    if (guest.couponCode && !userCart.couponCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
  await clearGuestCartCookie().catch(() => undefined);
}

/** Limpeza periódica de carrinhos de visitantes abandonados. */
export async function purgeStaleGuestCarts(olderThanDays = 60) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600_000);
  const { count } = await db.cart.deleteMany({ where: { userId: null, updatedAt: { lt: cutoff } } });
  return count;
}
