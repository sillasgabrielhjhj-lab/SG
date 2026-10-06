import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import type { SearchResult } from "@/features/search/service";
import { buildSearchHref, SORT_OPTIONS, type SearchFilters } from "@/features/search/schemas";
import { ProductGrid } from "@/components/commerce/product-grid";
import { FilterChip } from "@/components/ui/chip";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { FiltersPanel } from "@/features/search/components/filters-panel";
import { MobileFilters, SortSelect } from "@/features/search/components/listing-controls";

/** Layout padrão de listagens (busca, categoria, marca, loja, ofertas, campanha). */
export function Listing({ basePath, filters, result, favorites, hideCategoryFilter, emptyAction }: { basePath: string; filters: SearchFilters; result: SearchResult; favorites?: Set<string>; hideCategoryFilter?: boolean; emptyAction?: ReactNode }) {
  const sortHrefs = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, buildSearchHref(basePath, filters, { sort: o.value })]));
  const panel = <FiltersPanel basePath={basePath} filters={filters} facets={result.facets} hideCategory={hideCategoryFilter} />;
  const clearHref = buildSearchHref(basePath, { q: filters.q, category: hideCategoryFilter ? filters.category : undefined, brands: [], freeShipping: false, promotion: false, official: false, available: false, sort: filters.sort, page: 1, attrs: {} });
  return (
    <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside aria-label="Filtros" className="hidden lg:block">
        <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-card border border-line bg-surface p-4 scrollbar-none">{panel}</div>
      </aside>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg-muted" aria-live="polite">
            <strong className="text-fg">{formatNumber(result.total)}</strong> {result.total === 1 ? "resultado" : "resultados"}
          </p>
          <div className="flex items-center gap-2">
            <MobileFilters activeCount={result.appliedFilters.length}>{panel}</MobileFilters>
            <SortSelect value={filters.sort} hrefs={sortHrefs} />
          </div>
        </div>
        {result.appliedFilters.length ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {result.appliedFilters.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} href={chip.href} />
            ))}
            <a href={clearHref} className="text-xs font-semibold text-fg-muted hover:text-fg hover:underline">
              Limpar filtros
            </a>
          </div>
        ) : null}
        {result.items.length ? (
          <>
            <ProductGrid products={result.items} favorites={favorites} columns="default" priorityCount={4} />
            <Pagination className="mt-8" page={result.page} totalPages={result.totalPages} buildHref={(p) => buildSearchHref(basePath, filters, { page: p }, true)} />
          </>
        ) : (
          <EmptyState
            icon={<SearchX />}
            title={filters.q ? `Não encontramos resultados para “${filters.q}”` : "Nenhum produto encontrado"}
            description="Revise a ortografia, use termos mais genéricos ou remova alguns filtros."
            action={
              <>
                {result.appliedFilters.length ? <ButtonLink href={clearHref} variant="outline">Remover filtros</ButtonLink> : null}
                {emptyAction ?? <ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>}
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
