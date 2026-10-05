import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getOrderAdmin } from "@/features/orders/queries";
import { OrderManageView } from "@/features/orders/components/order-manage-view";

export const metadata = { title: "Pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionPage("admin:orders", `/admin/pedidos/${id}`);
  const order = await getOrderAdmin(id).catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return <OrderManageView order={order} mode="admin" storeName={order.store.isOfficial ? `${order.store.name} (Oficial)` : order.store.name} backHref="/admin/pedidos" />;
}
