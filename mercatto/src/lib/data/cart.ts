import "server-only";

import { prisma } from "@/lib/prisma";

export { computeCartSummary, type CartSummary } from "@/lib/cart-summary";

export async function getCartForUser(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      coupon: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: { images: { take: 1, orderBy: { position: "asc" } }, seller: true, inventory: true },
          },
          variant: { include: { inventory: true } },
        },
      },
    },
  });

  if (!cart) {
    return { id: null, items: [], coupon: null };
  }

  return cart;
}

export async function getCartItemCount(userId: string | null) {
  if (!userId) return 0;
  const result = await prisma.cartItem.aggregate({
    where: { cart: { userId } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}
