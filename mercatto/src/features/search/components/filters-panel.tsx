import Link from "next/link";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { buildSearchHref, serializeFilters, type SearchFilters } from "@/features/search/schemas";
import type { SearchFacets } from "@/features/search/service";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4 first:pt-0 last:border-0">
      <legend className="mb-2 text-sm font-bold text-fg">{title}</legend>
      <div className="flex flex-col gap-0.5">{children}</div>
    </fieldset>
  );
}

function Option({ href, label, count, active }: { href: string; label: React.ReactNode; count?: number; active?: boolean }) {
  return (
    <Link href={href} scroll={false} aria-current={active ? "true" : undefined} className={cn("flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors focus-ring", active ? "font-semibold text-brand-800" : "text-fg-muted hover:text-fg")}>
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", active ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-surface")} aria-hidden>
        {active ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="text-xs text-fg-subtle tabular">({count})</span> : null}
    </Link>
  );
}

/**
 * Filtros baseados em links (funcionam sem JavaScript, indexáveis e com a URL
 * como fonte da verdade). Cada clique alterna o filtro e volta à página 1.
 */
export function FiltersPanel({ basePath, filters, facets, hideCategory }: { basePath: string; filters: SearchFilters; facets: SearchFacets; hideCategory?: boolean }) {
  const href = (o: Partial<SearchFilters>) => buildSearchHref(basePath, filters, o);
  const hidden = serializeFilters({ ...filters, priceMin: undefined, priceMax: undefined, page: 1 });
  return (
    <div className="text-sm">
      {!hideCategory && facets.categories.length > 1 ? (
        <Group title="Categorias">
          {facets.categories.slice(0, 10).map((c) => (
            <Option key={c.id} href={href({ category: filters.category === c.slug ? undefined : c.slug, attrs: {} })} label={c.name} count={c.count} active={filters.category === c.slug} />
          ))}
        </Group>
      ) : null}

      <Group title="Entrega e vendedor">
        {facets.freeShippingCount > 0 || filters.freeShipping ? <Option href={href({ freeShipping: !filters.freeShipping })} label="Frete grátis" count={facets.freeShippingCount} active={filters.freeShipping} /> : null}
        {facets.officialCount > 0 || filters.official ? <Option href={href({ official: !filters.official })} label="Oficial Mercatto" count={facets.officialCount} active={filters.official} /> : null}
        {facets.promotionCount > 0 || filters.promotion ? <Option href={href({ promotion: !filters.promotion })} label="Em promoção" count={facets.promotionCount} active={filters.promotion} /> : null}
        <Option href={href({ available: !filters.available })} label="Somente disponíveis" active={filters.available} />
      </Group>

      <Group title="Preço">
        <form action={basePath} method="get" className="flex flex-col gap-2">
          {[...hidden.entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="preco_min">
              Preço mínimo
            </label>
            <input id="preco_min" name="preco_min" inputMode="decimal" placeholder="Mínimo" defaultValue={filters.priceMin !== undefined ? filters.priceMin / 100 : ""} className="h-9 w-full min-w-0 rounded-md border border-line-strong px-2 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
            <span className="text-fg-subtle">–</span>
            <label className="sr-only" htmlFor="preco_max">
              Preço máximo
            </label>
            <input id="preco_max" name="preco_max" inputMode="decimal" placeholder="Máximo" defaultValue={filters.priceMax !== undefined ? filters.priceMax / 100 : ""} className="h-9 w-full min-w-0 rounded-md border border-line-strong px-2 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
            <button type="submit" className="grid h-9 shrink-0 place-items-center rounded-md bg-brand-700 px-2.5 text-xs font-bold text-white hover:bg-brand-800 focus-ring" aria-label="Aplicar faixa de preço">
              OK
            </button>
          </div>
          {facets.priceRange ? (
            <p className="text-xs text-fg-subtle">
              De {formatBRL(facets.priceRange.min)} a {formatBRL(facets.priceRange.max)}
            </p>
          ) : null}
        </form>
      </Group>

      {facets.brands.length ? (
        <Group title="Marca">
          {facets.brands.slice(0, 12).map((b) => {
            const active = filters.brands.includes(b.slug);
            return <Option key={b.id} href={href({ brands: active ? filters.brands.filter((x) => x !== b.slug) : [...filters.brands, b.slug] })} label={b.name} count={b.count} active={active} />;
          })}
        </Group>
      ) : null}

      {facets.attributes.map((attr) => (
        <Group key={attr.key} title={attr.name}>
          {attr.values.slice(0, 10).map((v) => {
            const current = filters.attrs[attr.key] ?? [];
            const active = current.includes(v.value);
            const next = active ? current.filter((x) => x !== v.value) : [...current, v.value];
            const attrs = { ...filters.attrs };
            if (next.length) attrs[attr.key] = next;
            else delete attrs[attr.key];
            return <Option key={v.value} href={href({ attrs })} label={v.value} count={v.count} active={active} />;
          })}
        </Group>
      ))}

      {facets.conditions.length > 1 || filters.condition ? (
        <Group title="Condição">
          {facets.conditions.map((c) => (
            <Option key={c.value} href={href({ condition: filters.condition === c.value ? undefined : c.value })} label={c.label} count={c.count} active={filters.condition === c.value} />
          ))}
        </Group>
      ) : null}

      <Group title="Avaliação">
        {[4, 3].map((r) => (
          <Option
            key={r}
            href={href({ rating: filters.rating === r ? undefined : r })}
            active={filters.rating === r}
            label={
              <span className="inline-flex items-center gap-1">
                {r} <Star className="size-3.5 text-sun-500" fill="currentColor" aria-hidden /> ou mais
              </span>
            }
          />
        ))}
      </Group>

      {facets.stores.length > 1 && !basePath.startsWith("/loja/") ? (
        <Group title="Loja">
          {facets.stores.slice(0, 8).map((s) => (
            <Option key={s.slug} href={href({ store: filters.store === s.slug ? undefined : s.slug })} label={s.name} count={s.count} active={filters.store === s.slug} />
          ))}
        </Group>
      ) : null}
    </div>
  );
}
