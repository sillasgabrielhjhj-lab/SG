/**
 * Tipos e limites do carrinho (isomórficos: usados por serviços e pela UI).
 */

/** Identidade do carrinho: usuário logado OU hash do token de visitante. */
export type CartIdentity = { userId: string; guestTokenHash?: undefined } | { guestTokenHash: string; userId?: undefined };

export const CART_MAX_QUANTITY_PER_ITEM = 99;
export const CART_MAX_DISTINCT_ITEMS = 50;

export type CartLineStatus = "OK" | "ADJUST" | "UNAVAILABLE";

export type CartLineAlertType = "PRICE_CHANGED" | "PROMOTION_ENDED" | "INSUFFICIENT_STOCK" | "UNAVAILABLE" | "PROMOTION_LOW_STOCK";

export type CartLineAlert = {
  type: CartLineAlertType;
  message: string;
  /** Quantidade sugerida para o botão "Ajustar" (estoque insuficiente). */
  suggestedQuantity?: number;
};

export type CartLinePromotion = {
  id: string;
  name: string;
  isFlash: boolean;
  endsAt: string;
  /** Unidades restantes no estoque promocional (null = sem limite). */
  remaining: number | null;
  perCustomerLimit: number | null;
};

export type CartLineView = {
  itemId: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  optionValues: Record<string, string>;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  quantity: number;
  selected: boolean;
  stock: number;
  /** Máximo selecionável no seletor de quantidade (estoque e limite por item). */
  maxQuantity: number;
  /** Preço efetivo atual (com promoção), por unidade. */
  unitPriceCents: number;
  /** Preço base do anúncio (sem promoção), por unidade. */
  originalPriceCents: number;
  /** Preço "de" exibido riscado (pode ser o compareAt). */
  listPriceCents: number | null;
  discountPercent: number;
  promotion: CartLinePromotion | null;
  lineTotalCents: number;
  freeShipping: boolean;
  status: CartLineStatus;
  alerts: CartLineAlert[];
};

export type CartStoreGroup = {
  store: { id: string; name: string; slug: string; isOfficial: boolean };
  lines: CartLineView[];
  /** Subtotal dos itens selecionados e disponíveis da loja. */
  selectedSubtotalCents: number;
  /** Progresso para frete grátis (somente loja oficial com limite configurado). */
  freeShipping: { thresholdCents: number; remainingCents: number; reached: boolean } | null;
};

export type CartCouponState = {
  code: string;
  ok: boolean;
  message: string;
  discountCents: number;
  /** Cupom de frete grátis: o desconto é calculado no checkout, com o frete escolhido. */
  freeShipping: boolean;
};

export type CartTotalsView = {
  itemsCount: number;
  originalSubtotalCents: number;
  subtotalCents: number;
  promotionSavingsCents: number;
  couponDiscountCents: number;
  totalCents: number;
};

export type CartView = {
  cartId: string | null;
  groups: CartStoreGroup[];
  /** Unidades totais no carrinho (badge do header). */
  count: number;
  distinctCount: number;
  selectedCount: number;
  totals: CartTotalsView;
  coupon: CartCouponState | null;
  minOrderCents: number;
  canCheckout: boolean;
  /** Motivos que impedem o checkout (exibidos acima do botão). */
  blockers: string[];
  isGuest: boolean;
};

export type MiniCartLine = {
  itemId: string;
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  imageAlt: string;
  quantity: number;
  unitPriceCents: number;
  status: CartLineStatus;
};

export type MiniCart = {
  count: number;
  subtotalCents: number;
  lines: MiniCartLine[];
  /** Linhas além das exibidas no mini-carrinho. */
  moreCount: number;
};

/** Linha devolvida após adicionar ao carrinho (toast/mini-carrinho). */
export type AddedCartLine = {
  itemId: string;
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
};
