import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, ExternalLink, HelpCircle, QrCode, Star, Truck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getCustomerOrder } from "@/features/orders/queries";
import { ORDER_STATUS_DESCRIPTIONS } from "@/features/orders/state-machine";
import { AddressBlock, OrderStatusBadge, OrderTimeline } from "@/features/orders/components/order-ui";
import { CustomerOrderActions } from "@/features/orders/components/customer-order-actions";
import { ProductImage } from "@/components/commerce/product-image";
import { OfficialBadge } from "@/components/commerce/badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { formatBRL } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `Pedido ${number}` };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUserPage(`/minha-conta/pedidos/${number}`);
  const order = await getCustomerOrder(user.id, number).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const payment = order.checkout.payments[0];
  const canCancel = order.allowedTransitions.includes("CANCELLED");
  const canRequestRefund = order.allowedTransitions.includes("REFUND_REQUESTED");
  const refunded = order.refunds.filter((r) => r.status === "SUCCEEDED").reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/minha-conta/pedidos" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Meus pedidos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Pedido {order.number}</h1>
          <p className="text-sm text-fg-muted">
            Realizado em {formatDateTime(order.createdAt)} · {order.store.isOfficial ? "Vendido e entregue pela Mercatto" : `Vendido por ${order.store.name}`}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="px-3 py-1 text-sm" />
      </header>

      {order.status === "PENDING_PAYMENT" && order.checkout.status === "PENDING_PAYMENT" ? (
        <Alert tone="warning" title="Aguardando pagamento" action={<ButtonLink href={`/checkout/pagamento/${order.checkout.id}`} size="sm" variant="sun">Pagar agora</ButtonLink>}>
          {order.checkout.expiresAt ? `Pague até ${formatDateTime(order.checkout.expiresAt)} para garantir os produtos reservados.` : "Conclua o pagamento para confirmar a compra."}
        </Alert>
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-fg-muted">{ORDER_STATUS_DESCRIPTIONS[order.status]}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="items-title" className="rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 id="items-title" className="font-bold">
                Produtos
              </h2>
              {order.store.isOfficial ? <OfficialBadge compact /> : <Link href={`/loja/${order.store.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">{order.store.name}</Link>}
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 p-4">
                  <Link href={`/produto/${item.product.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md border border-line bg-white focus-ring">
                    <ProductImage src={item.imageUrl} alt={item.productName} sizes="80px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/produto/${item.product.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                      {item.productName}
                    </Link>
                    {item.variantName ? <p className="text-xs text-fg-muted">{item.variantName}</p> : null}
                    <p className="text-xs text-fg-subtle">SKU {item.sku}</p>
                    <p className="mt-1 text-sm">
                      {item.quantity} × <span className="tabular">{formatBRL(item.unitPriceCents)}</span>
                      {item.originalPriceCents > item.unitPriceCents ? <span className="ml-1.5 text-xs text-fg-subtle line-through">{formatBRL(item.originalPriceCents)}</span> : null}
                    </p>
                    {order.status === "DELIVERED" ? (
                      item.reviewed ? (
                        <Badge tone="success" size="xs" className="mt-2">
                          Avaliado
                        </Badge>
                      ) : (
                        <ButtonLink href={`/minha-conta/avaliacoes?item=${item.id}`} size="sm" variant="outline" className="mt-2" leftIcon={<Star className="size-4" />}>
                          Avaliar produto
                        </ButtonLink>
                      )
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular">{formatBRL(item.totalCents)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="timeline-title" className="rounded-card border border-line bg-surface p-4">
            <h2 id="timeline-title" className="mb-4 font-bold">
              Acompanhamento
            </h2>
            <OrderTimeline steps={order.timeline} />
          </section>

          {order.shipment ? (
            <section aria-labelledby="ship-title" className="rounded-card border border-line bg-surface p-4">
              <h2 id="ship-title" className="mb-3 flex items-center gap-2 font-bold">
                <Truck className="size-5 text-brand-700" aria-hidden /> Entrega
              </h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-fg-muted">Modalidade</dt>
                  <dd className="font-medium">
                    {order.shipment.service}
                    {order.shipment.carrier ? ` · ${order.shipment.carrier}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">Previsão</dt>
                  <dd className="font-medium">{order.deliveredAt ? `Entregue em ${formatDate(order.deliveredAt)}` : order.shipment.estimatedDeliveryAt ? `Até ${formatDate(order.shipment.estimatedDeliveryAt)}` : `${order.shipment.estimatedDays} dias úteis após a postagem`}</dd>
                </div>
                {order.shipment.trackingCode ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-fg-muted">Código de rastreio</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="rounded-md bg-surface-muted px-2 py-1 font-mono text-sm font-semibold">{order.shipment.trackingCode}</code>
                      <CopyButton value={order.shipment.trackingCode} size="sm" variant="outline" />
                      {order.shipment.trackingUrl ? (
                        <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                          Rastrear na transportadora <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <AddressBlock address={order.shippingAddress} className="mt-4 border-t border-line pt-4" />
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="sum-title" className="rounded-card border border-line bg-surface p-4">
            <h2 id="sum-title" className="mb-3 font-bold">
              Resumo
            </h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Produtos</dt>
                <dd className="tabular">{formatBRL(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 ? (
                <div className="flex justify-between text-success-700">
                  <dt>Descontos{order.checkout.couponCode ? ` (${order.checkout.couponCode})` : ""}</dt>
                  <dd className="tabular">−{formatBRL(order.discountCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-fg-muted">Frete</dt>
                <dd className="tabular">{order.shippingCents === 0 ? <span className="font-semibold text-success-700">Grátis</span> : formatBRL(order.shippingCents)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-extrabold">
                <dt>Total</dt>
                <dd className="tabular">{formatBRL(order.totalCents)}</dd>
              </div>
              {refunded > 0 ? (
                <div className="flex justify-between text-sm text-fg-muted">
                  <dt>Reembolsado</dt>
                  <dd className="tabular">{formatBRL(refunded)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {payment ? (
            <section aria-labelledby="pay-title" className="rounded-card border border-line bg-surface p-4">
              <h2 id="pay-title" className="mb-2 font-bold">
                Pagamento
              </h2>
              <p className="flex items-center gap-2 text-sm">
                {payment.method === "PIX" ? <QrCode className="size-4 text-brand-700" aria-hidden /> : <CreditCard className="size-4 text-brand-700" aria-hidden />}
                {payment.method === "PIX" ? "PIX" : `Cartão ${payment.cardBrand ?? ""} ${payment.cardLast4 ? `final ${payment.cardLast4}` : ""}`.trim()}
                {payment.method === "CREDIT_CARD" && payment.installments > 1 ? <span className="text-fg-muted">· {payment.installments}x</span> : null}
              </p>
              {payment.paidAt ? <p className="mt-1 text-xs text-fg-muted">Aprovado em {formatDateTime(payment.paidAt)}</p> : null}
              {payment.isSandbox ? (
                <Badge tone="warning" size="xs" className="mt-2">
                  Pagamento simulado (ambiente de demonstração)
                </Badge>
              ) : null}
            </section>
          ) : null}

          {!order.shipment ? (
            <section className="rounded-card border border-line bg-surface p-4">
              <h2 className="mb-2 font-bold">Endereço de entrega</h2>
              <AddressBlock address={order.shippingAddress} />
            </section>
          ) : null}

          {order.refunds.length ? (
            <section className="rounded-card border border-line bg-surface p-4">
              <h2 className="mb-2 font-bold">Reembolsos</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {order.refunds.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {formatDate(r.createdAt)} · {r.status === "SUCCEEDED" ? "Concluído" : r.status === "PENDING" ? "Em processamento" : "Falhou — o suporte foi avisado"}
                    </span>
                    <span className="font-semibold tabular">{formatBRL(r.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <CustomerOrderActions number={order.number} canCancel={canCancel && order.status === "PENDING_PAYMENT"} canRequestRefund={canRequestRefund} status={order.status} />

          <Link href="/ajuda" className="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-sm font-semibold text-brand-700 hover:bg-surface-muted focus-ring">
            <HelpCircle className="size-4" aria-hidden /> Preciso de ajuda com este pedido
          </Link>
        </aside>
      </div>
    </div>
  );
}
