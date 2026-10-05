import type { Metadata } from "next";
import { after } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { recordSearch, searchProducts } from "@/features/search/service";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SearchTracker } from "@/features/search/components/search-tracker";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseSearchParams(await searchParams);
  const title = f.q ? `${f.q} — busca` : "Buscar produtos";
  // Páginas de busca não são indexadas (conteúdo duplicado/infinito); seguem links.
  return { ...buildMetadata({ title, path: f.q ? `/buscar?q=${encodeURIComponent(f.q)}` : "/buscar", noindex: true }), robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  after(maybeSyncPromotions);
  const filters = parseSearchParams(await searchParams);
  const [result, user] = await Promise.all([searchProducts(filters), getCurrentUser()]);
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  if (filters.q && result.total > 0 && filters.page === 1) after(() => recordSearch(filters.q!));
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: filters.q ? `Busca: ${filters.q}` : "Busca" }]} />
      <h1 className="mt-2 mb-4 text-xl font-bold tracking-tight sm:text-2xl">{filters.q ? <>Resultados para “{filters.q}”</> : "Todos os produtos"}</h1>
      <SearchTracker term={filters.q ?? ""} results={result.total} />
      <Listing basePath="/buscar" filters={filters} result={result} favorites={favorites} />
    </div>
  );
}
