import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import type { ProductScope } from "@/features/products/service";
import { listManagedProducts } from "@/features/products/queries";
import { productListFiltersSchema } from "@/features/products/schemas";
import { ProductTable } from "@/features/products/components/product-table";
import { PageHeading } from "@/components/layout/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Publicados" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "PAUSED", label: "Pausados" },
  { value: "OUT_OF_STOCK", label: "Sem estoque" },
  { value: "ARCHIVED", label: "Arquivados" },
];

/** Listagem de produtos gerenciáveis (vendedor ou admin), com filtros na URL. */
export async function ProductListView({ scope, mode, basePath, searchParams, title, description, stores }: { scope: ProductScope | { kind: "admin-all" }; mode: "seller" | "admin"; basePath: string; searchParams: Record<string, string | undefined>; title: string; description?: string; stores?: { id: string; name: string }[] }) {
  const parsed = productListFiltersSchema.safeParse({ q: searchParams.q || undefined, status: searchParams.status || undefined, storeId: searchParams.loja || undefined, lowStock: searchParams.baixo === "1" || undefined, page: searchParams.pagina ?? 1, sort: searchParams.ordenar || undefined });
  const filters = parsed.success ? parsed.data : productListFiltersSchema.parse({});
  const data = await listManagedProducts(scope, filters);
  const href = (patch: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    const merged = { q: filters.q, status: filters.status, loja: filters.storeId, ordenar: filters.sort === "recent" ? undefined : filters.sort, pagina: undefined as string | number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "pagina" && Number(v) <= 1)) q.set(k, String(v));
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeading title={title} description={description ?? `${data.total} produto(s)`} actions={<ButtonLink href={`${basePath}/novo`} leftIcon={<Plus className="size-4" />}>Novo produto</ButtonLink>} />
      <nav aria-label="Filtrar por status" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {STATUS_TABS.map((t) => {
          const active = (filters.status ?? "") === t.value;
          return (
            <Link key={t.value} href={href({ status: t.value || undefined })} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium focus-ring", active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300")}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <form method="get" action={basePath} className="mb-4 flex flex-wrap gap-2">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar por nome ou SKU</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={filters.q} placeholder="Buscar por nome ou SKU" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        {stores ? (
          <select name="loja" defaultValue={filters.storeId ?? ""} aria-label="Loja" className="h-10 rounded-field border border-line-strong bg-surface px-3 text-sm">
            <option value="">Todas as lojas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
        <select name="ordenar" defaultValue={filters.sort} aria-label="Ordenar" className="h-10 rounded-field border border-line-strong bg-surface px-3 text-sm">
          <option value="recent">Atualizados recentemente</option>
          <option value="name">Nome (A–Z)</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="stock">Menor estoque</option>
          <option value="sales">Mais vendidos</option>
        </select>
        <label className="flex h-10 items-center gap-2 rounded-field border border-line-strong bg-surface px-3 text-sm">
          <input type="checkbox" name="baixo" value="1" defaultChecked={filters.lowStock} className="size-4 accent-brand-700" /> Estoque baixo
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Filtrar
        </button>
      </form>
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Package />} title={filters.q || filters.status ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} description={filters.q || filters.status ? "Ajuste os filtros para ver outros produtos." : "Cadastre o primeiro produto para começar a vender."} action={<ButtonLink href={`${basePath}/novo`}>Cadastrar produto</ButtonLink>} />
        </div>
      ) : (
        <ProductTable
          mode={mode}
          basePath={basePath}
          rows={data.items.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            status: p.status,
            isFeatured: p.isFeatured,
            isDemo: p.isDemo,
            minPriceCents: p.minPriceCents,
            effectivePriceCents: p.effectivePriceCents,
            totalStock: p.totalStock,
            salesCount: p.salesCount,
            updatedAt: p.updatedAt.toISOString(),
            imageUrl: p.images[0]?.url ?? null,
            categoryName: p.category.name,
            storeName: p.store.name,
            isOfficial: p.store.isOfficial,
            variantCount: p.variants.length,
            lowStock: p.variants.some((v) => v.status === "ACTIVE" && v.stock <= Math.max(v.minStock, 5)),
          }))}
        />
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
