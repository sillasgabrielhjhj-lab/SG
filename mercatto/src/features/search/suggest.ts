import "server-only";
import { db } from "@/server/db";
import { normalizeText } from "@/lib/utils";
import { matchText } from "@/features/search/service";
import { getProductCardsByIds } from "@/features/catalog/cards.server";

export type Suggestions = {
  terms: string[];
  categories: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
  products: { id: string; name: string; slug: string; imageUrl: string | null; priceCents: number }[];
};

/** Autocomplete: termos populares, produtos, categorias e marcas (rápido, com índices trigram/FTS). */
export async function suggest(q: string): Promise<Suggestions> {
  const normalized = normalizeText(q).slice(0, 80);
  if (normalized.length < 2) return { terms: [], categories: [], brands: [], products: [] };
  const [terms, categories, brands, matches] = await Promise.all([
    db.$queryRaw<{ term: string }[]>`
      SELECT "term" FROM "SearchTerm"
      WHERE "term" LIKE ${`${normalized}%`} OR ${normalized} <% "term"
      ORDER BY ("term" LIKE ${`${normalized}%`}) DESC, "count" DESC
      LIMIT 6`,
    db.category.findMany({ where: { isActive: true, name: { contains: q.trim(), mode: "insensitive" } }, select: { name: true, slug: true }, take: 4 }),
    db.brand.findMany({ where: { name: { contains: q.trim(), mode: "insensitive" }, products: { some: { status: "ACTIVE", store: { status: "ACTIVE" } } } }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 3 }),
    matchText(q),
  ]);
  const cards = await getProductCardsByIds(matches.slice(0, 6).map((m) => m.id), { preserveOrder: true });
  // Produtos encontrados também revelam suas categorias e marcas (ex.: "iphone" → Celulares, Apple).
  const extraCategories = categories.length ? [] : await db.category.findMany({ where: { isActive: true, products: { some: { id: { in: cards.map((c) => c.id) } } } }, select: { name: true, slug: true }, take: 3 });
  const extraBrands = brands.length ? [] : await db.brand.findMany({ where: { products: { some: { id: { in: cards.map((c) => c.id) } } } }, select: { name: true, slug: true }, take: 2 });
  return {
    terms: terms.map((t) => t.term),
    categories: [...categories, ...extraCategories],
    brands: [...brands, ...extraBrands],
    products: cards.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, priceCents: c.priceCents })),
  };
}

export async function popularSearches(limit = 8) {
  const rows = await db.searchTerm.findMany({ orderBy: { count: "desc" }, take: limit, select: { term: true } });
  return rows.map((r) => r.term);
}
