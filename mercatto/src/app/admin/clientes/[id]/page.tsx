import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { getCustomerAdmin } from "@/features/admin/queries";
import { OrderStatusBadge } from "@/features/orders/components/order-ui";
import { UserStatusButton } from "@/features/admin/components/people-actions";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatCep, formatDate, formatDateTime, formatPhone } from "@/lib/format";

export const metadata = { title: "Cliente" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePermissionPage("admin:customers", `/admin/clientes/${id}`);
  const c = await getCustomerAdmin(id);
  if (!c) notFound();
  const canManage = hasPermission(viewer.role, "admin:users.roles") && viewer.id !== c.id;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/clientes" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
          <p className="text-sm text-fg-muted">
            {c.email} {c.phone ? `· ${formatPhone(c.phone)}` : ""} · cliente desde {formatDate(c.createdAt)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={c.status === "ACTIVE" ? "success" : "danger"} size="xs">
              {c.status === "ACTIVE" ? "Ativo" : "Suspenso"}
            </Badge>
            <Badge tone={c.emailVerifiedAt ? "brand" : "warning"} size="xs">
              {c.emailVerifiedAt ? "E-mail confirmado" : "E-mail não confirmado"}
            </Badge>
            {c.lastLoginAt ? <Badge size="xs">Último acesso {formatDateTime(c.lastLoginAt)}</Badge> : null}
          </div>
        </div>
        {canManage ? <UserStatusButton userId={c.id} name={c.name} status={c.status} /> : null}
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-card border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 font-bold">Pedidos recentes</h2>
          {c.orders.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">Nenhum pedido.</p>
          ) : (
            <ul className="divide-y divide-line">
              {c.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/60 focus-ring">
                    <span className="flex-1 text-sm font-semibold">{o.number}</span>
                    <span className="text-xs text-fg-muted">{formatDate(o.createdAt)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 text-right text-sm font-bold tabular">{formatBRL(o.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-2 font-bold">Endereços</h2>
          {c.addresses.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhum endereço.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id}>
                  <p className="font-semibold">
                    {a.label || "Endereço"} {a.isDefault ? <Badge tone="brand" size="xs">Padrão</Badge> : null}
                  </p>
                  <p className="text-fg-muted">
                    {a.street}, {a.number}
                    {a.complement ? ` — ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · CEP {formatCep(a.cep)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
