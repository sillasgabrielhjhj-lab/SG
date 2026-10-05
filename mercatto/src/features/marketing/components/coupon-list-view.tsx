import { Plus, Search, Ticket } from "lucide-react";
import { listCoupons } from "@/features/marketing/queries";
import type { MarketingScope } from "@/features/marketing/service";
import { CouponTable, type CouponRow } from "@/features/marketing/components/coupon-table";
import { FilterTabs, buildListHref, type MarketingMode } from "@/features/marketing/components/marketing-ui";
import { PageHeading } from "@/components/layout/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

const TABS = [
  { value: "", label: "Todos" },
  { value: "1", label: "Ativos" },
  { value: "0", label: "Desativados" },
];

/** Lista de cupons com filtros na URL (?q= ?ativo=1|0 ?pagina=). */
export async function CouponListView({ mode, scope, basePath, searchParams }: { mode: MarketingMode; scope: MarketingScope | { kind: "all" }; basePath: string; searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q ?? "").trim().slice(0, 30) || undefined;
  const ativo = searchParams.ativo === "1" || searchParams.ativo === "0" ? searchParams.ativo : undefined;
  const page = Math.max(1, Number.parseInt(searchParams.pagina ?? "1", 10) || 1);
  const data = await listCoupons(scope, { q, active: ativo === undefined ? undefined : ativo === "1", page });
  const href = (patch: Record<string, string | number | undefined>) => buildListHref(basePath, { q, ativo, ...patch });

  const rows: CouponRow[] = data.items.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    maxDiscountCents: c.maxDiscountCents,
    minOrderCents: c.minOrderCents,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    usedCount: c.usedCount,
    usageLimit: c.usageLimit,
    state: c.state,
    isActive: c.isActive,
    isPublic: c.isPublic,
    storeName: c.store?.name ?? null,
    editable: mode === "seller" || c.storeId === null,
  }));

  const filtered = Boolean(q || ativo);
  return (
    <div>
      <PageHeading
        title="Cupons"
        description={mode === "seller" ? "Códigos de desconto válidos só para produtos da sua loja." : `Cupons da Mercatto e das lojas parceiras (${data.total}).`}
        actions={
          <ButtonLink href={`${basePath}/novo`} leftIcon={<Plus className="size-4" />}>
            Novo cupom
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs label="Filtrar por ativação" className="shrink-0" tabs={TABS.map((t) => ({ key: t.value || "all", label: t.label, href: href({ ativo: t.value || undefined }), active: (ativo ?? "") === t.value }))} />
        <form method="get" action={basePath} className="flex min-w-0 flex-1 gap-2" role="search">
          {ativo ? <input type="hidden" name="ativo" value={ativo} /> : null}
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar por código</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Buscar código" maxLength={30} className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm uppercase placeholder:normal-case focus:border-brand-600 focus:shadow-focus focus:outline-none" />
          </label>
          <button type="submit" className="h-10 shrink-0 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
            Buscar
          </button>
        </form>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={<Ticket />}
            title={filtered ? "Nenhum cupom encontrado" : "Nenhum cupom criado"}
            description={filtered ? "Ajuste a busca ou os filtros." : "Crie códigos de desconto para campanhas, redes sociais ou clientes fiéis."}
            action={<ButtonLink href={`${basePath}/novo`}>Criar cupom</ButtonLink>}
          />
        </div>
      ) : (
        <CouponTable rows={rows} mode={mode} basePath={basePath} />
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
