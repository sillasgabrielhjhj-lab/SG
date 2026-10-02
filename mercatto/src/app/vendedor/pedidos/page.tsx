import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getSellerByUserId, getSellerOrders } from "@/lib/data/seller";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_VARIANT } from "@/lib/order-status";
import { BecomeSellerForm } from "@/app/vendedor/become-seller-form";

export const metadata: Metadata = { title: "Pedidos" };

export default async function SellerOrdersPage() {
  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller) return <BecomeSellerForm />;

  const orders = await getSellerOrders(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos que incluem seus produtos.</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ShoppingBag className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const sellerTotal = order.items.reduce((sum, item) => sum + item.totalCents, 0);
            return (
              <Link
                key={order.id}
                href={`/vendedor/pedidos/${order.orderNumber}`}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.user.name} · {order.items.length} {order.items.length === 1 ? "item" : "itens"} ·{" "}
                    {order.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                  <p className="font-display font-semibold text-foreground">{formatCurrencyBRL(sellerTotal)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
