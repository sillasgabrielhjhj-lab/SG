import type { CatalogFilters, SortOption } from "@/lib/data/catalog";

const VALID_SORTS: SortOption[] = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
  "rating",
  "best_selling",
];

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogSearchParams(
  searchParams: RawSearchParams,
): Omit<CatalogFilters, "categoryIds"> {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const getAll = (key: string) => {
    const value = searchParams[key];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const minRaw = get("min");
  const maxRaw = get("max");
  const ratingRaw = get("avaliacao");
  const sortRaw = get("sort");
  const pageRaw = get("page");

  return {
    q: get("q")?.trim() || undefined,
    minPriceCents: minRaw ? Math.round(Number(minRaw) * 100) : undefined,
    maxPriceCents: maxRaw ? Math.round(Number(maxRaw) * 100) : undefined,
    brandSlugs: getAll("marca"),
    minRating: ratingRaw ? Number(ratingRaw) : undefined,
    sellerSlug: get("vendedor")?.trim() || undefined,
    onSale: get("promo") === "1",
    sort: VALID_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : "relevance",
    page: pageRaw ? Math.max(1, Number(pageRaw)) : 1,
  };
}
