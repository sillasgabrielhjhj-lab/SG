import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { normalizeText } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { CARD_SELECT, publicProductWhere, toProductCards } from "@/features/catalog/cards.server";
import { getAllCategories, getCategoryWithDescendantIds } from "@/features/catalog/categories.server";
import { buildSearchHref, CONDITION_LABELS, type AppliedFilterChip, type SearchFilters } from "@/features/search/schemas";
import type { ProductCardData } from "@/features/catalog/types";

const MAX_TEXT_MATCHES = 1000;

export type SearchFacets = {
  categories: { id: string; name: string; slug: string; count: number }[];
  brands: { id: string; name: string; slug: string; count: number }[];
  conditions: { value: "NEW" | "USED" | "REFURBISHED"; label: string; count: number }[];
  priceRange: { min: number; max: number } | null;
  ratings: { min: number; count: number }[];
  freeShippingCount: number;
  promotionCount: number;
  officialCount: number;
  stores: { name: string; slug: string; count: number }[];
  attributes: { key: string; name: string; values: { value: string; count: number }[] }[];
};

export type SearchResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  facets: SearchFacets;
  appliedFilters: AppliedFilterChip[];
  category: { id: string; name: string; slug: string } | null;
};

/**
 * Busca textual: full-text em português (stemming) OU todos os termos
 * presentes (LIKE com índice trigram) OU similaridade de palavra (erros de
 * digitação). Retorna ids ordenados por relevância. Sempre parametrizado.
 */
export async function matchText(q: string): Promise<{ id: string; rank: number }[]> {
  const normalized = normalizeText(q).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  // Consulta com cara de SKU/código (ex.: "MRC-0001-01"): correspondência literal apenas.
  if (/^[a-z0-9]+(?:[-_.][a-z0-9]+)+$/.test(normalized) && /\d/.test(normalized)) {
    return db.$queryRaw<{ id: string; rank: number }[]>`
      SELECT p."id", 1::float AS rank FROM "Product" p
      WHERE p."status" = 'ACTIVE' AND p."searchText" LIKE ${`%${normalized}%`}
      ORDER BY p."salesCount" DESC LIMIT ${MAX_TEXT_MATCHES}`;
  }
  const tokens = normalized.split(" ").filter((t) => t.length >= 2).slice(0, 8);
  const likeAll = tokens.length
    ? Prisma.join(tokens.map((t) => Prisma.sql`p."searchText" LIKE ${`%${t}%`}`), " AND ")
    : Prisma.sql`FALSE`;
  const rows = await db.$queryRaw<{ id: string; rank: number }[]>`
    SELECT p."id",
           (ts_rank(p."searchVector", websearch_to_tsquery('portuguese', ${normalized})) * 4
            + word_similarity(${normalized}, p."searchText")
            + CASE WHEN p."searchText" LIKE ${`${normalized}%`} THEN 1 ELSE 0 END
            -- Nome, marca e categorias ficam no início do texto de busca: pesam mais.
            + CASE WHEN position(${normalized} in left(p."searchText", 160)) > 0 THEN 1.5 ELSE 0 END
            + CASE WHEN position(left(${normalized}, greatest(length(${normalized}) - 2, 3)) in left(p."searchText", 160)) > 0 THEN 0.8 ELSE 0 END
            + ln(1 + p."salesCount") / 20)::float AS rank
    FROM "Product" p
    WHERE p."status" = 'ACTIVE'
      AND (
        p."searchVector" @@ websearch_to_tsquery('portuguese', ${normalized})
        OR (${likeAll})
        OR ${normalized} <% p."searchText"
      )
    ORDER BY rank DESC, p."salesCount" DESC
    LIMIT ${MAX_TEXT_MATCHES}
  `;
  return rows;
}

async function resolveScope(filters: SearchFilters) {
  const [category, brands, store] = await Promise.all([
    filters.category ? db.category.findFirst({ where: { slug: filters.category, isActive: true }, select: { id: true, name: true, slug: true } }) : null,
    filters.brands.length ? db.brand.findMany({ where: { slug: { in: filters.brands } }, select: { id: true, name: true, slug: true } }) : [],
    filters.store ? db.store.findFirst({ where: { slug: filters.store, status: "ACTIVE" }, select: { id: true, name: true, slug: true } }) : null,
  ]);
  const categoryIds = category ? await getCategoryWithDescendantIds(category.id) : null;
  return { category, categoryIds, brands, store };
}

function attributeWhere(attrs: SearchFilters["attrs"], defs: { id: string; key: string }[]): Prisma.ProductWhereInput[] {
  return Object.entries(attrs)
    .map(([key, values]) => {
      const def = defs.find((d) => d.key === key);
      return def ? { attributes: { some: { attributeId: def.id, value: { in: values } } } } : null;
    })
    .filter(Boolean) as Prisma.ProductWhereInput[];
}

function orderByFor(sort: SearchFilters["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "menor_preco":
      return [{ effectivePriceCents: "asc" }];
    case "maior_preco":
      return [{ effectivePriceCents: "desc" }];
    case "melhor_avaliados":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    case "novidades":
      return [{ publishedAt: "desc" }];
    case "maior_desconto":
      return [{ discountPercent: "desc" }, { salesCount: "desc" }];
    default:
      return [{ salesCount: "desc" }, { ratingCount: "desc" }];
  }
}

/**
 * Busca/listagem com filtros reais, facetas e paginação.
 * `fixed` permite páginas de categoria/loja/marca/oficial reaproveitarem o motor.
 */
export async function searchProducts(
  filters: SearchFilters,
  opts: { pageSize?: number; basePath?: string; fixed?: Prisma.ProductWhereInput } = {},
): Promise<SearchResult> {
  const pageSize = Math.min(opts.pageSize ?? 24, 50);
  const basePath = opts.basePath ?? "/buscar";
  const scope = await resolveScope(filters);

  // Filtro textual
  let textMatches: { id: string; rank: number }[] | null = null;
  if (filters.q) textMatches = await matchText(filters.q);

  // Atributos filtráveis disponíveis para a categoria escolhida (e ancestrais).
  const attrDefs = scope.category
    ? await db.categoryAttribute.findMany({
        where: { isFilterable: true, categoryId: { in: await categoryChain(scope.category.id) } },
        select: { id: true, key: true, name: true },
        orderBy: { position: "asc" },
      })
    : [];

  // Escopo base (texto + categoria + fixo) — usado também nas facetas.
  const base: Prisma.ProductWhereInput = {
    AND: [
      publicProductWhere,
      opts.fixed ?? {},
      textMatches ? { id: { in: textMatches.map((m) => m.id) } } : {},
      scope.categoryIds ? { categoryId: { in: scope.categoryIds } } : filters.category ? { id: "__none__" } : {},
    ],
  };
  const where: Prisma.ProductWhereInput = {
    AND: [
      base,
      scope.brands.length ? { brandId: { in: scope.brands.map((b) => b.id) } } : filters.brands.length ? { id: "__none__" } : {},
      filters.priceMin !== undefined ? { effectivePriceCents: { gte: filters.priceMin } } : {},
      filters.priceMax !== undefined ? { effectivePriceCents: { lte: filters.priceMax } } : {},
      filters.condition ? { condition: filters.condition } : {},
      filters.rating ? { ratingAvg: { gte: filters.rating } } : {},
      filters.freeShipping ? { freeShipping: true } : {},
      filters.promotion ? { OR: [{ hasActivePromotion: true }, { discountPercent: { gt: 0 } }] } : {},
      filters.official ? { store: { isOfficial: true } } : {},
      scope.store ? { storeId: scope.store.id } : filters.store ? { id: "__none__" } : {},
      filters.available ? { totalStock: { gt: 0 } } : {},
      ...attributeWhere(filters.attrs, attrDefs),
    ],
  };

  const skip = (filters.page - 1) * pageSize;
  let items: ProductCardData[];
  let total: number;
  if (textMatches && filters.sort === "relevancia") {
    // Relevância: ordena pelos ranks do texto, depois pagina.
    const allowed = await db.product.findMany({ where, select: { id: true }, take: MAX_TEXT_MATCHES });
    const allowedSet = new Set(allowed.map((a) => a.id));
    const ordered = textMatches.filter((m) => allowedSet.has(m.id)).map((m) => m.id);
    total = ordered.length;
    const pageIds = ordered.slice(skip, skip + pageSize);
    const rows = await db.product.findMany({ where: { id: { in: pageIds } }, select: CARD_SELECT });
    const byId = new Map((await toProductCards(rows)).map((c) => [c.id, c]));
    items = pageIds.map((id) => byId.get(id)).filter((c): c is ProductCardData => Boolean(c));
  } else {
    const [rows, count] = await Promise.all([
      db.product.findMany({ where, orderBy: [...orderByFor(filters.sort), { id: "asc" }], skip, take: pageSize, select: CARD_SELECT }),
      db.product.count({ where }),
    ]);
    items = await toProductCards(rows);
    total = count;
  }

  const facets = await computeFacets(base, attrDefs);
  return {
    items,
    total,
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
    facets,
    appliedFilters: appliedChips(basePath, filters, scope, attrDefs),
    category: scope.category,
  };
}

async function categoryChain(categoryId: string) {
  const all = await getAllCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const chain: string[] = [];
  let cur = byId.get(categoryId);
  let guard = 0;
  while (cur && guard++ < 10) {
    chain.push(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

async function computeFacets(base: Prisma.ProductWhereInput, attrDefs: { id: string; key: string; name: string }[]): Promise<SearchFacets> {
  const [byCategory, byBrand, byCondition, price, freeShippingCount, promotionCount, officialCount, byStore, rating4, rating3, attrRows] = await Promise.all([
    db.product.groupBy({ by: ["categoryId"], where: base, _count: { _all: true } }),
    db.product.groupBy({ by: ["brandId"], where: { AND: [base, { brandId: { not: null } }] }, _count: { _all: true } }),
    db.product.groupBy({ by: ["condition"], where: base, _count: { _all: true } }),
    db.product.aggregate({ where: base, _min: { effectivePriceCents: true }, _max: { effectivePriceCents: true } }),
    db.product.count({ where: { AND: [base, { freeShipping: true }] } }),
    db.product.count({ where: { AND: [base, { OR: [{ hasActivePromotion: true }, { discountPercent: { gt: 0 } }] }] } }),
    db.product.count({ where: { AND: [base, { store: { isOfficial: true } }] } }),
    db.product.groupBy({ by: ["storeId"], where: base, _count: { _all: true }, orderBy: { _count: { storeId: "desc" } }, take: 10 }),
    db.product.count({ where: { AND: [base, { ratingAvg: { gte: 4 } }] } }),
    db.product.count({ where: { AND: [base, { ratingAvg: { gte: 3 } }] } }),
    attrDefs.length
      ? db.productAttributeValue.groupBy({ by: ["attributeId", "value"], where: { attributeId: { in: attrDefs.map((a) => a.id) }, product: base }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  const [categories, brands, stores] = await Promise.all([
    getAllCategories(),
    db.brand.findMany({ where: { id: { in: byBrand.map((b) => b.brandId!).filter(Boolean) } }, select: { id: true, name: true, slug: true } }),
    db.store.findMany({ where: { id: { in: byStore.map((s) => s.storeId) } }, select: { id: true, name: true, slug: true } }),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const storeById = new Map(stores.map((s) => [s.id, s]));

  return {
    categories: byCategory
      .map((c) => ({ ...catById.get(c.categoryId), count: c._count._all }))
      .filter((c): c is { id: string; name: string; slug: string; count: number } & Record<string, unknown> => Boolean(c.id))
      .map(({ id, name, slug, count }) => ({ id, name, slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    brands: byBrand
      .map((b) => ({ brand: brandById.get(b.brandId!), count: b._count._all }))
      .filter((b) => b.brand)
      .map((b) => ({ id: b.brand!.id, name: b.brand!.name, slug: b.brand!.slug, count: b.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    conditions: byCondition.map((c) => ({ value: c.condition, label: CONDITION_LABELS[c.condition], count: c._count._all })),
    priceRange: price._min.effectivePriceCents !== null && price._max.effectivePriceCents !== null ? { min: price._min.effectivePriceCents, max: price._max.effectivePriceCents } : null,
    ratings: [
      { min: 4, count: rating4 },
      { min: 3, count: rating3 },
    ],
    freeShippingCount,
    promotionCount,
    officialCount,
    stores: byStore
      .map((s) => ({ store: storeById.get(s.storeId), count: s._count._all }))
      .filter((s) => s.store)
      .map((s) => ({ name: s.store!.name, slug: s.store!.slug, count: s.count })),
    attributes: attrDefs
      .map((def) => ({
        key: def.key,
        name: def.name,
        values: (attrRows as { attributeId: string; value: string; _count: { _all: number } }[])
          .filter((r) => r.attributeId === def.id)
          .map((r) => ({ value: r.value, count: r._count._all }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      }))
      .filter((a) => a.values.length > 0),
  };
}

function appliedChips(
  basePath: string,
  f: SearchFilters,
  scope: Awaited<ReturnType<typeof resolveScope>>,
  attrDefs: { key: string; name: string }[],
): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  if (scope.category && basePath === "/buscar") chips.push({ key: "categoria", label: scope.category.name, href: buildSearchHref(basePath, f, { category: undefined, attrs: {} }) });
  for (const b of scope.brands) chips.push({ key: `marca:${b.slug}`, label: b.name, href: buildSearchHref(basePath, f, { brands: f.brands.filter((x) => x !== b.slug) }) });
  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    const label = f.priceMin !== undefined && f.priceMax !== undefined ? `${formatBRL(f.priceMin)} a ${formatBRL(f.priceMax)}` : f.priceMin !== undefined ? `A partir de ${formatBRL(f.priceMin)}` : `Até ${formatBRL(f.priceMax!)}`;
    chips.push({ key: "preco", label, href: buildSearchHref(basePath, f, { priceMin: undefined, priceMax: undefined }) });
  }
  if (f.condition) chips.push({ key: "condicao", label: CONDITION_LABELS[f.condition], href: buildSearchHref(basePath, f, { condition: undefined }) });
  if (f.rating) chips.push({ key: "avaliacao", label: `${f.rating}+ estrelas`, href: buildSearchHref(basePath, f, { rating: undefined }) });
  if (f.freeShipping) chips.push({ key: "frete", label: "Frete grátis", href: buildSearchHref(basePath, f, { freeShipping: false }) });
  if (f.promotion) chips.push({ key: "promocao", label: "Em promoção", href: buildSearchHref(basePath, f, { promotion: false }) });
  if (f.official) chips.push({ key: "oficial", label: "Oficial Mercatto", href: buildSearchHref(basePath, f, { official: false }) });
  if (scope.store && !basePath.startsWith("/loja/")) chips.push({ key: "loja", label: scope.store.name, href: buildSearchHref(basePath, f, { store: undefined }) });
  if (f.available) chips.push({ key: "disponivel", label: "Disponível", href: buildSearchHref(basePath, f, { available: false }) });
  for (const [key, values] of Object.entries(f.attrs)) {
    const def = attrDefs.find((d) => d.key === key);
    if (!def) continue;
    for (const v of values) {
      const rest = values.filter((x) => x !== v);
      const attrs = { ...f.attrs };
      if (rest.length) attrs[key] = rest;
      else delete attrs[key];
      chips.push({ key: `attr:${key}:${v}`, label: `${def.name}: ${v}`, href: buildSearchHref(basePath, f, { attrs }) });
    }
  }
  return chips;
}

/** Registra termos buscados com resultado (alimenta sugestões populares). */
export async function recordSearch(term: string) {
  const normalized = normalizeText(term).slice(0, 80);
  if (normalized.length < 2) return;
  await db.searchTerm.upsert({
    where: { term: normalized },
    update: { count: { increment: 1 }, lastSearchedAt: new Date() },
    create: { term: normalized },
  });
}
