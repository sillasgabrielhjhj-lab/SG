/** Desconto padrão da loja pra pagamento via Pix (à vista, sem taxa de
 * parcelamento) — mesma política pra todo produto, por isso não é um campo
 * por produto. Ajuste aqui se quiser mudar o percentual em toda a loja. */
export const PIX_DISCOUNT_PERCENT = 5;

export function pixPriceCents(priceCents: number): number {
  return Math.round(priceCents * (1 - PIX_DISCOUNT_PERCENT / 100));
}

/**
 * Um produto só é tratado como "em oferta" (badge, preço riscado) quando:
 * - não tem preço riscado definido, OU
 * - não tem janela de promoção definida (desconto permanente), OU
 * - a data atual está dentro da janela definida.
 * Fora da janela, o preço riscado continua salvo no banco (pra não perder
 * o histórico), mas a interface trata o produto como preço normal.
 */
export function isPromotionActive(product: {
  compareAtPriceCents: number | null;
  promotionStartsAt: Date | null;
  promotionEndsAt: Date | null;
}): boolean {
  if (!product.compareAtPriceCents) return false;
  if (!product.promotionStartsAt && !product.promotionEndsAt) return true;

  const now = Date.now();
  if (product.promotionStartsAt && now < product.promotionStartsAt.getTime()) return false;
  if (product.promotionEndsAt && now > product.promotionEndsAt.getTime()) return false;
  return true;
}
