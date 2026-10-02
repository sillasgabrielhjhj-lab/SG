import type { Metadata } from "next";

import { getAdminOrders } from "@/lib/data/admin";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_VARIANT } from "@/lib/order-status";

export const metadata: Metadata = { title: "Pedidos" };

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pedidos</h1>
        <p className="text-sm text-muted-foreground">{orders.length} pedidos na plataforma</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Pedido</th>
              <th className="py-3 pr-4 font-medium">Cliente</th>
              <th className="py-3 pr-4 font-medium">Itens</th>
              <th className="py-3 pr-4 font-medium">Total</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-sm font-medium text-foreground">{order.orderNumber}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{order.user.name}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{order.items.length}</td>
                <td className="py-3 pr-4 text-sm text-foreground">{formatCurrencyBRL(order.totalCents)}</td>
                <td className="py-3 pr-4">
                  <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </td>
                <td className="py-3 text-sm text-muted-foreground">{order.createdAt.toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
