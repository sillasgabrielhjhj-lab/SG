/**
 * Camada de analytics (eventos de e-commerce padrão GA4). Centraliza o envio:
 * hoje empilha em window.dataLayer (compatível com GTM/GA4) e, em
 * desenvolvimento, registra no console. Nenhum dado pessoal é enviado.
 *
 * Mapa de nomes de produto → evento (um único evento por ação, sem duplicar):
 *   product_view → view_item          product_click → select_item
 *   add_to_cart → add_to_cart         remove_from_cart → remove_from_cart
 *   wishlist_add → add_to_wishlist    search → search
 *   checkout_start → begin_checkout   purchase → purchase
 *   banner_click → select_promotion   (banner visto → view_promotion)
 *   coupon_view → coupon_view         coupon_copy → coupon_copy
 *   coupon_apply → coupon_applied
 */
export type AnalyticsEvent =
  | "view_item"
  | "view_item_list"
  | "search"
  | "select_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "add_shipping_info"
  | "add_payment_info"
  | "purchase"
  | "add_to_wishlist"
  | "coupon_applied"
  | "coupon_view"
  | "coupon_copy"
  | "view_promotion"
  | "select_promotion";

type Params = Record<string, string | number | boolean | null | undefined | Record<string, unknown>[]>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** Eventos padrão do Pixel do Meta correspondentes. */
const META_EVENTS: Partial<Record<AnalyticsEvent, string>> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "Purchase",
  search: "Search",
  add_to_wishlist: "AddToWishlist",
};

function metaParams(p: Params) {
  const qty = typeof p.quantity === "number" ? p.quantity : 1;
  const value = typeof p.value === "number" ? p.value : typeof p.price === "number" ? p.price * qty : undefined;
  return {
    currency: "BRL",
    ...(value !== undefined ? { value } : {}),
    ...(p.item_id ? { content_ids: [String(p.item_id)], content_type: "product" } : {}),
    ...(p.item_name ? { content_name: String(p.item_name) } : {}),
    ...(p.search_term ? { search_string: String(p.search_term) } : {}),
    ...(typeof p.num_items === "number" ? { num_items: p.num_items } : {}),
  };
}

export function trackEvent(event: AnalyticsEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    if (window.gtag) window.gtag("event", event, { currency: "BRL", ...params });
    else (window.dataLayer = window.dataLayer ?? []).push({ event, ecommerce: { currency: "BRL", ...params } });
    const metaEvent = META_EVENTS[event];
    if (metaEvent && window.fbq) window.fbq("track", metaEvent, metaParams(params), params.transaction_id ? { eventID: String(params.transaction_id) } : undefined);
    if (process.env.NODE_ENV === "development") console.info("[analytics]", event, params);
  } catch {
    /* analytics nunca quebra a experiência */
  }
}
