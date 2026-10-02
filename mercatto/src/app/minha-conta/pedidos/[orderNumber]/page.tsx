import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, MapPin, CreditCard } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getOrderDetail } from "@/lib/data/orders";
import { cancelOrderAction, requestReturnAction } from "@/lib/actions/orders";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE_VARIANT,
  CANCELLABLE_STATUSES,
  RETURNABLE_STATUSES,
} from "@/lib/order-status";
import { OrderActionDialog } from "@/components/orders/order-action-dialog";
import { OrderTimeline } from "@/components/orders/order-timeline";

type Props = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Pedido ${orderNumber}` };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  PIX: "Pix",
  BOLETO: "Boleto",
};

export default async function OrderDetailPage({ params }: Props) {
  const user = await requireUser();
  const { orderNumber } = await params;

  const order = await getOrderDetail(user.id, orderNumber);
  if (!order) notFound();

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const canReturn = RETURNABLE_STATUSES.includes(order.status) && !order.returnRequestedAt;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/minha-conta/pedidos" className="text-sm text-muted-foreground hover:text-primary">
            ← Meus pedidos
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-foreground">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Feito em {order.createdAt.toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]} className="text-sm">
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {order.cancelReason && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Cancelado: {order.cancelReason}
        </p>
      )}
      {order.returnRequestedAt && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Devolução solicitada em {order.returnRequestedAt.toLocaleDateString("pt-BR")}: {order.returnReason}
        </p>
      )}

      <div className="rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Status do pedido</h2>
        <div className="mt-4">
          <OrderTimeline
            status={order.status}
            createdAt={order.createdAt}
            paidAt={order.payment?.paidAt}
            shippedAt={order.shipment?.shippedAt}
            deliveredAt={order.shipment?.deliveredAt}
            cancelledAt={order.cancelledAt}
            cancelReason={order.cancelReason}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Itens</h2>
        <div className="mt-4 flex flex-col gap-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.product.images[0]?.url ?? "/placeholders/ph-0.svg"}
                alt=""
                className="size-16 rounded-md object-cover"
              />
              <div className="flex-1">
                <Link href={`/produto/${item.product.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {item.productNameSnapshot}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Vendido por {item.seller.storeName} · Qtd: {item.quantity}
                </p>
              </div>
              <p className="font-medium text-foreground">{formatCurrencyBRL(item.totalCents)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <MapPin className="size-4" /> Endereço de entrega
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {order.shippingAddress.recipientName}
            <br />
            {order.shippingAddress.street}, {order.shippingAddress.number}
            {order.shippingAddress.complement ? ` — ${order.shippingAddress.complement}` : ""}
            <br />
            {order.shippingAddress.neighborhood}, {order.shippingAddress.city} - {order.shippingAddress.state}
            <br />
            CEP {order.shippingAddress.zipCode}
          </p>
        </div>

        <div className="rounded-xl border border-border p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Truck className="size-4" /> Rastreamento
          </h3>
          {order.shipment ? (
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Transportadora: {order.shipment.carrier}</p>
              {order.shipment.trackingCode && <p>Código: {order.shipment.trackingCode}</p>}
              {order.shipment.estimatedDelivery && (
                <p>Previsão: {order.shipment.estimatedDelivery.toLocaleDateString("pt-BR")}</p>
              )}
              {order.shipment.deliveredAt && (
                <p>Entregue em: {order.shipment.deliveredAt.toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Ainda sem informações de envio.</p>
          )}
        </div>
      </div>

      {order.payment && (
        <div className="rounded-xl border border-border p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <CreditCard className="size-4" /> Pagamento
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {PAYMENT_METHOD_LABELS[order.payment.method]}
            {order.payment.installments > 1 ? ` em ${order.payment.installments}x` : ""} ·{" "}
            {formatCurrencyBRL(order.payment.amountCents)}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border p-5">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrencyBRL(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-success">
              <span>Desconto {order.coupon ? `(${order.coupon.code})` : ""}</span>
              <span>-{formatCurrencyBRL(order.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Frete</span>
            <span>{order.shippingCents === 0 ? "Grátis" : formatCurrencyBRL(order.shippingCents)}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-lg font-bold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyBRL(order.totalCents)}</span>
        </div>
      </div>

      {(canCancel || canReturn) && (
        <div className="flex gap-2">
          {canCancel && (
            <OrderActionDialog
              orderNumber={order.orderNumber}
              triggerLabel="Cancelar pedido"
              title="Cancelar pedido"
              description="Essa ação não pode ser desfeita. O estoque dos itens será devolvido."
              reasonLabel="Motivo do cancelamento"
              action={cancelOrderAction}
              variant="destructive"
            />
          )}
          {canReturn && (
            <OrderActionDialog
              orderNumber={order.orderNumber}
              triggerLabel="Solicitar devolução"
              title="Solicitar devolução"
              description="Conte o que aconteceu — o vendedor vai analisar sua solicitação."
              reasonLabel="Motivo da devolução"
              action={requestReturnAction}
            />
          )}
        </div>
      )}
    </div>
  );
}
