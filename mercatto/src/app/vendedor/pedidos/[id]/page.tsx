import { notFound } from "next/navigation";
import { requireSellerPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getStoreOrder } from "@/features/orders/queries";
import { OrderManageView } from "@/features/orders/components/order-manage-view";

export const metadata = { title: "Pedido" };

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSellerPage(`/vendedor/pedidos/${id}`);
  const order = await getStoreOrder(user.storeId, id).catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return <OrderManageView order={order} mode="seller" backHref="/vendedor/pedidos" />;
}
