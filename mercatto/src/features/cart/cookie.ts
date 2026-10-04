import "server-only";
import { cookies } from "next/headers";
import { isProduction } from "@/server/env";
import { generateToken, hashToken } from "@/server/auth/tokens";

/**
 * Carrinho de visitante: o cookie guarda um token aleatório; o banco guarda
 * apenas o hash (Cart.guestToken). Ao fazer login o carrinho é mesclado.
 */
export const CART_COOKIE = isProduction ? "__Host-mrc_cart" : "mrc_cart";
const CART_TTL_DAYS = 60;

/** Hash do token do carrinho anônimo atual (ou null). */
export async function getGuestCartTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return hashToken(token);
}

/**
 * Garante um token de carrinho anônimo (somente em Server Actions/Route
 * Handlers, onde cookies podem ser definidos). Retorna o hash.
 */
export async function ensureGuestCartTokenHash(): Promise<string> {
  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value;
  if (!token || token.length > 100) {
    token = generateToken();
    store.set(CART_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: CART_TTL_DAYS * 24 * 60 * 60,
    });
  }
  return hashToken(token);
}

export async function clearGuestCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}
