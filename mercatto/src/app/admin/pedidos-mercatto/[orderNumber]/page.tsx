import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

import { getOfficialSeller, getSellerOrderDetail } from "@/lib/data/seller";
import { advanceMercattoOrderStatusAction } from "@/lib/actions/admin-orders";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_VARIANT } from "@/lib/order-status";
import { AdvanceStatusForm } from "@/components/seller/advance-status-form";

type Props = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Pedido ${orderNumber}` };
}

export default async function AdminMercattoOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const seller = await getOfficialSeller();
  if (!seller) notFound();

  const order = await getSellerOrderDetail(seller.id, orderNumber);
  if (!order) notFound();

  const mercattoTotal = order.items.reduce((sum, item) => sum + item.totalCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/pedidos-mercatto" className="text-sm text-muted-foreground hover:text-primary">
          ← Pedidos do Mercatto
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-foreground">{order.orderNumber}</h1>
          <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cliente: {order.user.name} ({order.user.email}) · {order.createdAt.toLocaleDateString("pt-BR")}
        </p>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Itens deste pedido</h2>
        <div className="mt-4 flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.product.images[0]?.url ?? "/placeholders/ph-0.svg"} alt="" className="size-14 rounded-md object-cover" />
              <div className="flex-1">
                <p className="text-foreground">{item.productNameSnapshot}</p>
                <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
              </div>
              <p className="font-medium text-foreground">{formatCurrencyBRL(item.totalCents)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-border pt-3 font-display font-semibold text-foreground">
          <span>Total (itens Mercatto)</span>
          <span>{formatCurrencyBRL(mercattoTotal)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <MapPin className="size-4" /> Enviar para
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {order.shippingAddress.recipientName} — {order.shippingAddress.street}, {order.shippingAddress.number}
          {order.shippingAddress.complement ? ` (${order.shippingAddress.complement})` : ""}
          <br />
          {order.shippingAddress.neighborhood}, {order.shippingAddress.city} - {order.shippingAddress.state} ·{" "}
          {order.shippingAddress.zipCode}
        </p>
      </div>

      <AdvanceStatusForm orderNumber={order.orderNumber} currentStatus={order.status} action={advanceMercattoOrderStatusAction} />
    </div>
  );
}
