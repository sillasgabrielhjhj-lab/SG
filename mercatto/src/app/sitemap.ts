import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { absoluteUrl } from "@/features/seo/site";

export const revalidate = 3600;

/** Sitemap com páginas públicas indexáveis (produtos ativos de lojas ativas, categorias, marcas, lojas e campanhas). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, categories, brands, stores, campaigns] = await Promise.all([
    db.product.findMany({ where: { status: { in: ["ACTIVE", "OUT_OF_STOCK"] }, store: { status: "ACTIVE" } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 45_000 }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.brand.findMany({ where: { products: { some: { status: "ACTIVE" } } }, select: { slug: true, updatedAt: true } }),
    db.store.findMany({ where: { status: "ACTIVE", isOfficial: false }, select: { slug: true, updatedAt: true } }),
    db.campaign.findMany({ where: { isActive: true, endsAt: { gt: now } }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["/", "/ofertas", "/oficial", "/categorias", "/vender", "/sobre", "/ajuda", "/contato", "/termos", "/privacidade", "/trocas-e-devolucoes", "/seguranca", "/cookies"];
  return [
    ...staticPages.map((p) => ({ url: absoluteUrl(p), lastModified: now, changeFrequency: p === "/" || p === "/ofertas" ? ("daily" as const) : ("monthly" as const), priority: p === "/" ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: absoluteUrl(`/categoria/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: absoluteUrl(`/produto/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: absoluteUrl(`/marca/${b.slug}`), lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...stores.map((s) => ({ url: absoluteUrl(`/loja/${s.slug}`), lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...campaigns.map((c) => ({ url: absoluteUrl(`/campanha/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
