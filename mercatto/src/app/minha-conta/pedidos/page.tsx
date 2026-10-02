import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getOrdersForUser } from "@/lib/data/orders";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_VARIANT } from "@/lib/order-status";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getOrdersForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Meus pedidos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas compras.</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/minha-conta/pedidos/${order.orderNumber}`}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {order.items.slice(0, 3).map((item) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={item.id}
                      src={item.product.images[0]?.url ?? "/placeholders/ph-0.svg"}
                      alt=""
                      className="size-12 rounded-md border-2 border-background object-cover"
                    />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} {order.items.length === 1 ? "item" : "itens"} ·{" "}
                    {order.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
                <p className="font-display font-semibold text-foreground">
                  {formatCurrencyBRL(order.totalCents)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
