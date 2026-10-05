import "server-only";
import { logger } from "@/server/observability/logger";
import { mergeGuestCartOnLogin } from "@/features/cart/service";

/**
 * Executado após login/cadastro bem-sucedido: mescla o carrinho de visitante
 * no carrinho do usuário. Falhas não impedem o login.
 */
export async function onUserSignedIn(userId: string) {
  try {
    await mergeGuestCartOnLogin(userId);
  } catch (error) {
    logger.warn("auth.cart_merge_failed", { userId, error });
  }
}
