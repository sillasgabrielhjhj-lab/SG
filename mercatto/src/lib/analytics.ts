/**
 * Camada de analytics (eventos de e-commerce padrão GA4). Centraliza o envio:
 * hoje empilha em window.dataLayer (compatível com GTM/GA4) e, em
 * desenvolvimento, registra no console. Nenhum dado pessoal é enviado.
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
  | "coupon_applied";

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
