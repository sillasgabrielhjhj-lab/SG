import "server-only";
import { db } from "@/server/db";
import { getSession } from "@/server/auth/session";
import { getGuestCartTokenHash } from "@/features/cart/cookie";

/** Quantidade total de unidades no carrinho atual (usuário ou visitante). */
export async function getCartItemCount(): Promise<number> {
  const session = await getSession();
  const where = session
    ? { cart: { userId: session.user.id } }
    : await getGuestCartTokenHash().then((h) => (h ? { cart: { guestToken: h } } : null));
  if (!where) return 0;
  const agg = await db.cartItem.aggregate({ where, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
