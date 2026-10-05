import type { OrderStatus } from "@/generated/prisma/enums";
import { requireSellerPage } from "@/server/auth/guards";
import { listStoreOrders } from "@/features/orders/queries";
import { ORDER_STATUSES } from "@/features/orders/state-machine";
import { OrderListView } from "@/features/orders/components/order-list-view";

export const metadata = { title: "Pedidos" };

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pagina?: string }> }) {
  const user = await requireSellerPage("/vendedor/pedidos");
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const data = await listStoreOrders(user.storeId, { page: Math.max(1, Number(sp.pagina) || 1), status, q });
  return <OrderListView rows={data.items} basePath="/vendedor/pedidos" page={data.page} totalPages={data.totalPages} total={data.total} status={status} q={q} counts={data.counts} />;
}
