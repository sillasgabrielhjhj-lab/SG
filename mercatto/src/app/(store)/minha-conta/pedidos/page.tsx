import Link from "next/link";
import { ChevronRight, Package, Truck } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requireUserPage } from "@/server/auth/guards";
import { listCustomerOrders } from "@/features/orders/queries";
import { ORDER_STATUSES } from "@/features/orders/state-machine";
import { OrderStatusBadge } from "@/features/orders/components/order-ui";
import { ProductImage } from "@/components/commerce/product-image";
import { OfficialBadge } from "@/components/commerce/badges";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Pedidos" };

const FILTERS: { label: string; status?: OrderStatus }[] = [
  { label: "Todos" },
  { label: "Aguardando pagamento", status: "PENDING_PAYMENT" },
  { label: "Em preparação", status: "PROCESSING" },
  { label: "Enviados", status: "SHIPPED" },
  { label: "Entregues", status: "DELIVERED" },
  { label: "Cancelados", status: "CANCELLED" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; pagina?: string }> }) {
  const user = await requireUserPage("/minha-conta/pedidos");
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const data = await listCustomerOrders(user.id, { page, status });
  const href = (p: { status?: OrderStatus; page?: number }) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (p.page && p.page > 1) q.set("pagina", String(p.page));
    const s = q.toString();
    return `/minha-conta/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeading title="Meus pedidos" description={`${data.total} pedido(s)`} />
      <nav aria-label="Filtrar pedidos" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const active = f.status === status;
          return (
            <Link key={f.label} href={href({ status: f.status })} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap focus-ring", active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300")}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Package />} title={status ? "Nenhum pedido com este status" : "Você ainda não fez pedidos"} description="Seus pedidos aparecem aqui com o status atualizado em tempo real." action={<ButtonLink href="/">Começar a comprar</ButtonLink>} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((o) => (
            <li key={o.id} className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted/50 px-4 py-2.5 text-xs text-fg-muted">
                <span>
                  {formatDate(o.createdAt)} · Pedido <strong className="text-fg">{o.number}</strong>
                </span>
                <span className="flex items-center gap-2">
                  {o.store.isOfficial ? <OfficialBadge compact /> : <span>Vendido por {o.store.name}</span>}
                </span>
              </div>
              <Link href={`/minha-conta/pedidos/${o.number}`} className="flex items-center gap-3 p-4 hover:bg-surface-muted/40 focus-ring">
                <div className="grid shrink-0 grid-cols-2 gap-1">
                  {o.items.slice(0, o._count.items > 4 ? 3 : 4).map((item, i) => (
                    <span key={i} className={cn("relative overflow-hidden rounded-md border border-line bg-white", o._count.items === 1 ? "col-span-2 size-16" : "size-8")}>
                      <ProductImage src={item.imageUrl} alt="" sizes="64px" />
                    </span>
                  ))}
                  {o._count.items > 4 ? <span className="grid size-8 place-items-center rounded-md bg-surface-muted text-2xs font-bold text-fg-muted">+{o._count.items - 3}</span> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <OrderStatusBadge status={o.status} />
                  <p className="mt-1 line-clamp-2 text-sm font-medium">
                    {o.items[0]?.productName}
                    {o._count.items > 1 ? <span className="text-fg-muted"> + {o._count.items - 1} item(ns)</span> : null}
                  </p>
                  {o.shipment?.trackingCode && ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(o.status) ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-brand-800">
                      <Truck className="size-3.5" aria-hidden /> Rastreio {o.shipment.trackingCode}
                    </p>
                  ) : o.status === "PENDING_PAYMENT" ? (
                    <p className="mt-1 text-xs font-semibold text-warning-700">Conclua o pagamento para confirmar a compra</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular">{formatBRL(o.totalCents)}</span>
                  <ChevronRight className="size-5 text-fg-subtle" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ status, page: p })} />
    </div>
  );
}
