import Link from "next/link";
import { ArrowLeft, CreditCard, QrCode, Truck, UserRound } from "lucide-react";
import type { getStoreOrder } from "@/features/orders/queries";
import { statusBeforeRefundRequest } from "@/features/orders/state-machine";
import { AddressBlock, OrderStatusBadge, OrderTimeline } from "@/features/orders/components/order-ui";
import { OrderManageActions } from "@/features/orders/components/order-manage-actions";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime, formatPhone } from "@/lib/format";

type ManagedOrder = Awaited<ReturnType<typeof getStoreOrder>>;

/** Detalhe do pedido para quem opera (vendedor/admin). */
export function OrderManageView({ order, mode, backHref, storeName }: { order: ManagedOrder; mode: "seller" | "admin"; backHref: string; storeName?: string }) {
  const payment = order.checkout.payments[0];
  const refunded = order.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amountCents, 0);
  const refundable = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) ? order.totalCents - refunded : 0;
  const lastRefundRequest = [...order.events].reverse().find((e) => e.status === "REFUND_REQUESTED");

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Pedido {order.number}</h1>
          <p className="text-sm text-fg-muted">
            {formatDateTime(order.createdAt)}
            {storeName ? ` · ${storeName}` : ""}
            {order.paidAt ? ` · pago em ${formatDateTime(order.paidAt)}` : ""}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="px-3 py-1 text-sm" />
      </header>

      {order.status === "REFUND_REQUESTED" ? (
        <div role="status" className="rounded-card border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-700">
          <p className="font-bold">O cliente solicitou cancelamento/devolução</p>
          {lastRefundRequest?.note ? <p>Motivo: “{lastRefundRequest.note}”</p> : null}
          <p className="mt-1">Aprove para estornar o valor ao cliente ou recuse para retornar ao status anterior.</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-card border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 font-bold">Itens ({order.items.length})</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 p-4">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                    <ProductImage src={item.imageUrl} alt="" sizes="64px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{item.productName}</p>
                    <p className="text-xs text-fg-muted">
                      {item.variantName ? `${item.variantName} · ` : ""}SKU <span className="font-mono">{item.sku}</span>
                    </p>
                    <p className="mt-1 text-sm">
                      {item.quantity} × {formatBRL(item.unitPriceCents)}
                      {item.discountCents > 0 ? <span className="ml-2 text-xs text-success-700">(desconto {formatBRL(item.discountCents)})</span> : null}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular">{formatBRL(item.totalCents)}</p>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 border-t border-line p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd className="tabular">{formatBRL(order.subtotalCents)}</dd>
              </div>
              {order.discountCents ? (
                <div className="flex justify-between text-success-700">
                  <dt>Descontos{order.checkout.couponCode ? ` (${order.checkout.couponCode})` : ""}</dt>
                  <dd className="tabular">−{formatBRL(order.discountCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-fg-muted">Frete ({order.shippingService})</dt>
                <dd className="tabular">{formatBRL(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
                <dt>Total</dt>
                <dd className="tabular">{formatBRL(order.totalCents)}</dd>
              </div>
              {refunded ? (
                <div className="flex justify-between text-danger-700">
                  <dt>Reembolsado</dt>
                  <dd className="tabular">−{formatBRL(refunded)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-4 font-bold">Histórico</h2>
            <OrderTimeline steps={order.timeline} />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 font-bold">Ações</h2>
            <OrderManageActions mode={mode} orderId={order.id} status={order.status} transitions={order.allowedTransitions} refundableCents={refundable} previousStatus={order.status === "REFUND_REQUESTED" ? statusBeforeRefundRequest(order.events) : null} />
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-2 flex items-center gap-2 font-bold">
              <UserRound className="size-4 text-brand-700" aria-hidden /> Cliente
            </h2>
            <p className="text-sm font-semibold">{order.user.name}</p>
            {mode === "admin" ? <p className="text-sm text-fg-muted">{order.user.email}</p> : null}
            {order.user.phone ? <p className="text-sm text-fg-muted">{formatPhone(order.user.phone)}</p> : null}
            {order.customerNote ? <p className="mt-2 rounded-md bg-surface-muted p-2 text-sm">Observação: {order.customerNote}</p> : null}
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-2 flex items-center gap-2 font-bold">
              <Truck className="size-4 text-brand-700" aria-hidden /> Entrega
            </h2>
            <AddressBlock address={order.shippingAddress} />
            {order.shipment ? (
              <dl className="mt-3 grid gap-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-fg-muted">Modalidade</dt>
                  <dd>
                    {order.shipment.service} ({order.shipment.estimatedDays} dias)
                  </dd>
                </div>
                {order.shipment.trackingCode ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-fg-muted">Rastreio</dt>
                    <dd className="font-mono font-semibold">{order.shipment.trackingCode}</dd>
                  </div>
                ) : null}
                {order.shipment.carrier ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-fg-muted">Transportadora</dt>
                    <dd>{order.shipment.carrier}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>

          {payment ? (
            <section className="rounded-card border border-line bg-surface p-4">
              <h2 className="mb-2 font-bold">Pagamento</h2>
              <p className="flex items-center gap-2 text-sm">
                {payment.method === "PIX" ? <QrCode className="size-4 text-brand-700" aria-hidden /> : <CreditCard className="size-4 text-brand-700" aria-hidden />}
                {payment.method === "PIX" ? "PIX" : `Cartão ${payment.cardBrand ?? ""} ${payment.cardLast4 ? `•••• ${payment.cardLast4}` : ""}`}
                {payment.installments > 1 ? ` · ${payment.installments}x` : ""}
              </p>
              <p className="text-xs text-fg-muted">Status do pagamento: {payment.status}</p>
              {payment.isSandbox ? (
                <Badge tone="warning" size="xs" className="mt-2">
                  Sandbox — sem cobrança real
                </Badge>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
