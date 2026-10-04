/** Utilidades de URL absoluta para SEO (canonical, Open Graph, sitemap). */
export const SITE_NAME = "Mercatto";
export const DEFAULT_DESCRIPTION =
  "Marketplace brasileiro com ofertas oficiais Mercatto e lojas parceiras verificadas. PIX, parcelamento e entrega para todo o Brasil.";

export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
