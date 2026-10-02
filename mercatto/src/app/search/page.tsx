import type { Metadata } from "next";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getBrandsForFilter, queryProducts } from "@/lib/data/catalog";
import { parseCatalogSearchParams, type RawSearchParams } from "@/lib/data/parse-filters";
import { CatalogToolbar, CatalogFiltersSidebar } from "@/components/catalog/catalog-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { CatalogPagination } from "@/components/catalog/pagination";
import { SearchHistoryTracker } from "@/components/search/search-history-tracker";

type Props = {
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolved = await searchParams;
  const q = Array.isArray(resolved.q) ? resolved.q[0] : resolved.q;
  return { title: q ? `"${q}"` : "Buscar" };
}

export default async function SearchPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const filters = parseCatalogSearchParams(resolvedSearchParams);

  const [brands, result] = await Promise.all([
    getBrandsForFilter(),
    queryProducts(filters),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page py-6">
          {filters.q && <SearchHistoryTracker query={filters.q} />}

          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {filters.q ? (
              <>
                Resultados para <span className="text-primary">&quot;{filters.q}&quot;</span>
              </>
            ) : (
              "Buscar produtos"
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>

          <div className="mt-6 flex gap-8">
            <CatalogFiltersSidebar basePath="/search" brands={brands} />

            <div className="flex-1">
              <CatalogToolbar basePath="/search" brands={brands} />
              <div className="mt-5">
                <ProductGrid products={result.items} />
              </div>
              <CatalogPagination
                basePath="/search"
                searchParams={resolvedSearchParams}
                page={result.page}
                pageCount={result.pageCount}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
