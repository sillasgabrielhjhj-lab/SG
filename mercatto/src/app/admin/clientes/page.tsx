import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listUsersAdmin } from "@/features/admin/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { buildHref } from "@/components/layout/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Clientes" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requirePermissionPage("admin:customers", "/admin/clientes");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const data = await listUsersAdmin({ q, role: "CUSTOMER", page: Math.max(1, Number(sp.pagina) || 1) });
  return (
    <div>
      <PageHeading title="Clientes" description={`${data.total} cliente(s)`} />
      <form method="get" className="mb-4 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Nome ou e-mail" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Buscar
        </button>
      </form>
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Users />} title="Nenhum cliente encontrado" />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {data.items.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/clientes/${u.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-muted/60 focus-ring">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{u.name}</span>
                  <span className="block truncate text-xs text-fg-muted">{u.email}</span>
                </span>
                <span className="text-xs text-fg-muted">{u._count.orders} pedido(s)</span>
                <span className="text-xs text-fg-muted">desde {formatDate(u.createdAt)}</span>
                <span className="flex gap-1">
                  {u.status === "SUSPENDED" ? <Badge tone="danger" size="xs">Suspenso</Badge> : null}
                  {!u.emailVerifiedAt ? <Badge tone="warning" size="xs">E-mail não confirmado</Badge> : null}
                  {u.isDemo ? <Badge tone="outline" size="xs">DEMO</Badge> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => buildHref("/admin/clientes", { q, pagina: p })} />
    </div>
  );
}
