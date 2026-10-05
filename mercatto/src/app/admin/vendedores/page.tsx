import Link from "next/link";
import { ExternalLink, Search, Store } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listStoresAdmin } from "@/features/admin/queries";
import { StoreStatusActions } from "@/features/admin/components/people-actions";
import { PageHeading } from "@/components/layout/page-heading";
import { FilterTabs, buildHref } from "@/components/layout/filter-tabs";
import { RatingStars } from "@/components/commerce/rating";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Vendedores" };

const STATUS = { PENDING: { label: "Em análise", tone: "warning" }, ACTIVE: { label: "Ativa", tone: "success" }, SUSPENDED: { label: "Suspensa", tone: "danger" } } as const;
const maskDoc = (d: string | null) => !d ? "—" : (d.length > 11 ? `**.***.***/${d.slice(8, 12)}-${d.slice(12)}` : `***.***.${d.slice(6, 9)}-${d.slice(9)}`);

export default async function AdminSellersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pagina?: string }> }) {
  await requirePermissionPage("admin:sellers", "/admin/vendedores");
  const sp = await searchParams;
  const status = sp.status === "PENDING" || sp.status === "ACTIVE" || sp.status === "SUSPENDED" ? sp.status : undefined;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const data = await listStoresAdmin({ status, q, page: Math.max(1, Number(sp.pagina) || 1) });
  const href = (p: Record<string, string | number | undefined>) => buildHref("/admin/vendedores", { status, q, ...p });
  return (
    <div>
      <PageHeading title="Vendedores" description="Aprove novas lojas e acompanhe a reputação dos parceiros." />
      <FilterTabs label="Status da loja" items={[{ label: "Todas", href: href({ status: undefined, pagina: undefined }), active: !status }, ...(["PENDING", "ACTIVE", "SUSPENDED"] as const).map((s) => ({ label: STATUS[s].label, href: href({ status: s, pagina: undefined }), active: status === s }))]} />
      <form method="get" className="mb-4 flex gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="relative flex-1">
          <span className="sr-only">Buscar loja</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Nome da loja" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Buscar
        </button>
      </form>
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Store />} title="Nenhuma loja encontrada" />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{s.name}</p>
                  <Badge tone={STATUS[s.status].tone} size="xs">
                    {STATUS[s.status].label}
                  </Badge>
                  {s.isOfficial ? <Badge tone="solid" size="xs">Oficial</Badge> : null}
                  {s.status === "ACTIVE" ? (
                    <Link href={s.isOfficial ? "/oficial" : `/loja/${s.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                      Ver loja <ExternalLink className="size-3" aria-hidden />
                    </Link>
                  ) : null}
                </div>
                <p className="text-xs text-fg-muted">
                  {s.owner.name} · {s.owner.email} · doc. {maskDoc(s.document)} · {s.originState ?? "—"} · desde {formatDate(s.createdAt)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                  <span>{s._count.products} produto(s)</span>
                  <span>{formatNumber(s.salesCount)} vendas</span>
                  <span>{s.cancelledCount} cancelamento(s)</span>
                  {s.ratingCount ? <RatingStars value={s.ratingAvg} count={s.ratingCount} size="xs" /> : <span>Sem avaliações</span>}
                </p>
              </div>
              <StoreStatusActions storeId={s.id} name={s.name} status={s.status} isOfficial={s.isOfficial} />
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
