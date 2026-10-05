import Link from "next/link";
import { ChevronRight, Search, ShoppingBag } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_LABELS } from "@/features/orders/state-machine";
import { OrderStatusBadge } from "@/features/orders/components/order-ui";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

type Row = {
  id: string;
  number: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  user: { name: string; email?: string };
  store: { name: string; isOfficial: boolean };
  shipment: { trackingCode: string | null } | null;
  _count: { items: number };
};

const TABS: (OrderStatus | "")[] = ["", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUND_REQUESTED", "CANCELLED"];

/** Listagem de pedidos para operação (vendedor/admin). */
export function OrderListView({ rows, basePath, page, totalPages, total, status, q, counts, showStore }: { rows: Row[]; basePath: string; page: number; totalPages: number; total: number; status?: OrderStatus; q?: string; counts?: Partial<Record<OrderStatus, number>>; showStore?: boolean }) {
  const href = (p: { status?: string; page?: number; q?: string }) => {
    const s = new URLSearchParams();
    if (p.status) s.set("status", p.status);
    if (p.q) s.set("q", p.q);
    if (p.page && p.page > 1) s.set("pagina", String(p.page));
    const str = s.toString();
    return `${basePath}${str ? `?${str}` : ""}`;
  };
  return (
    <div>
      <PageHeading title="Pedidos" description={`${total} pedido(s)`} />
      <nav aria-label="Filtrar por status" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = (status ?? "") === t;
          const count = t && counts ? counts[t] : undefined;
          return (
            <Link key={t || "all"} href={href({ status: t || undefined, q })} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap focus-ring", active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300")}>
              {t ? ORDER_STATUS_LABELS[t] : "Todos"}
              {count ? <span className="rounded-full bg-surface-muted px-1.5 text-2xs font-bold">{count}</span> : null}
            </Link>
          );
        })}
      </nav>
      <form method="get" action={basePath} className="mb-4 flex gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="relative flex-1">
          <span className="sr-only">Buscar pedido</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Número do pedido ou nome do cliente" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Buscar
        </button>
      </form>
      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<ShoppingBag />} title="Nenhum pedido encontrado" />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`${basePath}/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-muted/60 focus-ring sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{o.number}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {formatDateTime(o.createdAt)} · {o.user.name}
                    {showStore ? ` · ${o.store.isOfficial ? "Oficial Mercatto" : o.store.name}` : ""} · {o._count.items} item(ns)
                    {o.shipment?.trackingCode ? ` · ${o.shipment.trackingCode}` : ""}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
                <span className="w-28 text-right text-sm font-bold tabular">{formatBRL(o.totalCents)}</span>
                <ChevronRight className="hidden size-5 text-fg-subtle sm:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={page} totalPages={totalPages} buildHref={(p) => href({ status, q, page: p })} />
    </div>
  );
}
