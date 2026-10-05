import { ClipboardList } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listAuditLogs } from "@/features/admin/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { buildHref } from "@/components/layout/filter-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Auditoria" };

const ENTITIES = ["Product", "ProductVariant", "Order", "Payment", "Refund", "User", "Store", "Promotion", "Coupon", "Campaign", "Category", "Brand", "Banner", "StoreSettings", "ShippingRule", "Review", "Question"];
const json = (v: unknown) => (v === null || v === undefined ? "—" : JSON.stringify(v, null, 2));

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ entidade?: string; acao?: string; pagina?: string }> }) {
  await requirePermissionPage("admin:audit", "/admin/auditoria");
  const sp = await searchParams;
  const entityType = ENTITIES.includes(sp.entidade ?? "") ? sp.entidade : undefined;
  const action = sp.acao?.trim().slice(0, 60) || undefined;
  const data = await listAuditLogs({ entityType, action, page: Math.max(1, Number(sp.pagina) || 1) });
  return (
    <div>
      <PageHeading title="Auditoria" description="Registro imutável de ações administrativas, financeiras e de estoque." />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <select name="entidade" defaultValue={entityType ?? ""} aria-label="Entidade" className="h-10 rounded-field border border-line-strong bg-surface px-3 text-sm">
          <option value="">Todas as entidades</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input name="acao" defaultValue={action} placeholder="Ação (ex.: order., product.price)" aria-label="Ação" className="h-10 min-w-56 flex-1 rounded-field border border-line-strong bg-surface px-3 text-sm focus:border-brand-600 focus:outline-none" />
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Filtrar
        </button>
      </form>
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<ClipboardList />} title="Nenhum registro" />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {data.items.map((l) => (
            <li key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs font-semibold text-brand-800">{l.action}</span>
                <span className="text-xs text-fg-muted">
                  {l.entityType}
                  {l.entityId ? ` · ${l.entityId}` : ""}
                </span>
                <span className="ml-auto text-xs text-fg-muted">
                  {formatDateTime(l.createdAt)} · {l.actor ? `${l.actor.name} (${l.actor.email})` : "Sistema"}
                </span>
              </div>
              {l.before || l.after ? (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-700">Ver alterações</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <pre className="max-h-64 overflow-auto rounded-md bg-surface-muted p-2 text-xs">{json(l.before)}</pre>
                    <pre className="max-h-64 overflow-auto rounded-md bg-surface-muted p-2 text-xs">{json(l.after)}</pre>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => buildHref("/admin/auditoria", { entidade: entityType, acao: action, pagina: p })} />
    </div>
  );
}
