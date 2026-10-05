import Link from "next/link";
import { Store, X } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { listAllOrders } from "@/features/orders/queries";
import { ORDER_STATUSES } from "@/features/orders/state-machine";
import { OrderListView } from "@/features/orders/components/order-list-view";

export const metadata = { title: "Pedidos" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pagina?: string; loja?: string }> }) {
  await requirePermissionPage("admin:orders", "/admin/pedidos");
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const storeId = sp.loja && /^[\w-]{1,40}$/.test(sp.loja) ? sp.loja : undefined;
  const [data, counts, store] = await Promise.all([
    listAllOrders({ page: Math.max(1, Number(sp.pagina) || 1), status, q, storeId }),
    db.order.groupBy({ by: ["status"], where: storeId ? { storeId } : {}, _count: { _all: true } }),
    storeId ? db.store.findUnique({ where: { id: storeId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-3">
      {store ? (
        <p className="flex flex-wrap items-center gap-2 rounded-card border border-info-600/30 bg-info-50 px-4 py-2.5 text-sm text-info-700">
          <Store className="size-4" aria-hidden /> Mostrando apenas pedidos da loja <strong>{store.name}</strong>
          <Link href="/admin/pedidos" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline focus-ring">
            <X className="size-4" aria-hidden /> Remover filtro
          </Link>
        </p>
      ) : null}
      <OrderListView
        rows={data.items}
        basePath="/admin/pedidos"
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        status={status}
        q={q}
        counts={Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<OrderStatus, number>>}
        showStore
      />
    </div>
  );
}
