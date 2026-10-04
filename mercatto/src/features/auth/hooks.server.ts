import "server-only";
import { logger } from "@/server/observability/logger";

/**
 * Executado após login/cadastro bem-sucedido: mescla o carrinho de visitante
 * no carrinho do usuário. Falhas não impedem o login.
 */
export async function onUserSignedIn(userId: string) {
  try {
    const cart = await import("@/features/cart/service");
    if ("mergeGuestCartOnLogin" in cart && typeof cart.mergeGuestCartOnLogin === "function") {
      await (cart.mergeGuestCartOnLogin as (userId: string) => Promise<unknown>)(userId);
    }
  } catch (error) {
    logger.warn("auth.cart_merge_failed", { userId, error });
  }
}
