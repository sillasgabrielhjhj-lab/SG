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
  }
}

export function trackEvent(event: AnalyticsEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ecommerce: { currency: "BRL", ...params } });
    if (process.env.NODE_ENV === "development") console.info("[analytics]", event, params);
  } catch {
    /* analytics nunca quebra a experiência */
  }
}
