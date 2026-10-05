import { Search, UserCog } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { requirePermissionPage } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/rbac";
import { listUsersAdmin } from "@/features/admin/queries";
import { UserRoleSelect, UserStatusButton } from "@/features/admin/components/people-actions";
import { PageHeading } from "@/components/layout/page-heading";
import { FilterTabs, buildHref } from "@/components/layout/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Usuários e papéis" };

const ROLES = ["CUSTOMER", "SELLER", "SUPPORT", "ADMIN"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ papel?: string; q?: string; pagina?: string }> }) {
  const viewer = await requirePermissionPage("admin:users.roles", "/admin/usuarios");
  const sp = await searchParams;
  const role = (ROLES as readonly string[]).includes(sp.papel ?? "") ? (sp.papel as Role) : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const data = await listUsersAdmin({ q, role, page: Math.max(1, Number(sp.pagina) || 1) });
  const href = (p: Record<string, string | number | undefined>) => buildHref("/admin/usuarios", { papel: role, q, ...p });
  return (
    <div>
      <PageHeading title="Usuários e papéis" description="Mudanças de papel encerram as sessões da pessoa e ficam registradas na auditoria." />
      <FilterTabs label="Papel" items={[{ label: "Todos", href: href({ papel: undefined, pagina: undefined }), active: !role }, ...ROLES.map((r) => ({ label: ROLE_LABELS[r], href: href({ papel: r, pagina: undefined }), active: role === r }))]} />
      <form method="get" className="mb-4 flex gap-2">
        {role ? <input type="hidden" name="papel" value={role} /> : null}
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
          <EmptyState icon={<UserCog />} title="Nenhum usuário encontrado" />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {data.items.map((u) => {
            const self = u.id === viewer.id;
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {u.name} {self ? <span className="text-xs font-normal text-fg-muted">(você)</span> : null}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {u.email} · desde {formatDate(u.createdAt)}
                    {u.store ? ` · loja ${u.store.name}` : ""}
                  </p>
                </div>
                {u.status === "SUSPENDED" ? <Badge tone="danger" size="xs">Suspenso</Badge> : null}
                <UserRoleSelect userId={u.id} name={u.name} role={u.role} disabled={self} />
                <UserStatusButton userId={u.id} name={u.name} status={u.status} disabled={self} />
              </li>
            );
          })}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
