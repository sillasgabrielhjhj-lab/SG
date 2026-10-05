import Link from "next/link";
import { AlertTriangle, ArrowRight, Eye, MessageCircleQuestion, Package, Percent, Receipt, ShoppingBag, Truck } from "lucide-react";
import { requireSellerPage } from "@/server/auth/guards";
import { getSellerDashboard } from "@/features/metrics/dashboards";
import type { MetricsPeriod } from "@/features/metrics/core";
import { OrderStatusBadge } from "@/features/orders/components/order-ui";
import { SalesChart } from "@/components/charts/sales-chart";
import { PeriodTabs } from "@/components/charts/period-tabs";
import { ProductImage } from "@/components/commerce/product-image";
import { RatingStars } from "@/components/commerce/rating";
import { PageHeading } from "@/components/layout/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/money";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Visão geral" };

const parsePeriod = (v?: string): MetricsPeriod => (v === "7" ? 7 : v === "90" ? 90 : 30);

export default async function SellerDashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireSellerPage("/vendedor");
  const days = parsePeriod((await searchParams).periodo);
  const d = await getSellerDashboard(user.storeId, days);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={`Olá, ${user.name.split(" ")[0]}`} description="Resumo do desempenho da sua loja." actions={<PeriodTabs current={days} basePath="/vendedor" />} />

      {d.pending.toShip || d.pending.unanswered || d.lowStock.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {d.pending.toShip ? (
            <Link href="/vendedor/pedidos?status=PAID" className="flex items-center gap-3 rounded-card border border-info-600/30 bg-info-50 p-3 text-sm text-info-700 hover:shadow-raised focus-ring">
              <Truck className="size-5" aria-hidden /> <span className="flex-1 font-semibold">{d.pending.toShip} pedido(s) para preparar e enviar</span> <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          {d.pending.unanswered ? (
            <Link href="/vendedor/perguntas" className="flex items-center gap-3 rounded-card border border-warning-600/30 bg-warning-50 p-3 text-sm text-warning-700 hover:shadow-raised focus-ring">
              <MessageCircleQuestion className="size-5" aria-hidden /> <span className="flex-1 font-semibold">{d.pending.unanswered} pergunta(s) sem resposta</span> <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          {d.lowStock.length ? (
            <Link href="/vendedor/estoque?baixo=1" className="flex items-center gap-3 rounded-card border border-danger-600/30 bg-danger-50 p-3 text-sm text-danger-700 hover:shadow-raised focus-ring">
              <AlertTriangle className="size-5" aria-hidden /> <span className="flex-1 font-semibold">{d.lowStock.length} variação(ões) com estoque baixo</span> <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Faturamento" value={formatBRL(d.kpis.revenue.value)} change={d.kpis.revenue.change} icon={<Receipt />} />
        <StatCard label="Pedidos" value={formatNumber(d.kpis.orders.value)} change={d.kpis.orders.change} icon={<ShoppingBag />} />
        <StatCard label="Ticket médio" value={formatBRL(d.kpis.avgTicket.value)} change={d.kpis.avgTicket.change} icon={<Receipt />} />
        <StatCard label="Unidades" value={formatNumber(d.kpis.units.value)} change={d.kpis.units.change} icon={<Package />} />
        <StatCard label="Visitas" value={formatNumber(d.kpis.visits.value)} change={d.kpis.visits.change} icon={<Eye />} />
        <StatCard label="Conversão" value={`${(d.kpis.conversion.value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} change={d.kpis.conversion.change} icon={<Percent />} />
      </div>

      <section aria-labelledby="chart-title" className="rounded-card border border-line bg-surface p-4">
        <h2 id="chart-title" className="font-bold">
          Faturamento diário
        </h2>
        <SalesChart data={d.series} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="top-title" className="rounded-card border border-line bg-surface">
          <h2 id="top-title" className="border-b border-line px-4 py-3 font-bold">
            Mais vendidos no período
          </h2>
          {d.topProducts.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">Sem vendas no período.</p>
          ) : (
            <ol className="divide-y divide-line">
              {d.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 text-sm font-bold text-fg-subtle">{i + 1}</span>
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                    <ProductImage src={p.imageUrl} alt="" sizes="40px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/vendedor/produtos/${p.productId}`} className="line-clamp-1 text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-xs text-fg-muted">
                      {p.units} un. · estoque {p.stock}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular">{formatBRL(p.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="recent-title" className="rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="recent-title" className="font-bold">
              Pedidos recentes
            </h2>
            <Link href="/vendedor/pedidos" className="text-sm font-semibold text-brand-700 hover:underline">
              Ver todos
            </Link>
          </div>
          {d.recentOrders.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">Nenhum pedido ainda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/vendedor/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/60 focus-ring">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{o.number}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {o.user.name} · {formatDate(o.createdAt)} · {o._count.items} item(ns)
                      </span>
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 text-right text-sm font-bold tabular">{formatBRL(o.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {d.store ? (
        <section className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-card border border-line bg-surface p-4 text-sm">
          <span className="font-bold">Reputação</span>
          {d.store.ratingCount ? <RatingStars value={d.store.ratingAvg} count={d.store.ratingCount} showValue /> : <span className="text-fg-muted">Ainda sem avaliações</span>}
          <span>
            <strong className="tabular">{formatNumber(d.store.salesCount)}</strong> vendas concluídas
          </span>
          <span>
            Cancelamentos: <strong className="tabular">{d.store.salesCount ? ((d.store.cancelledCount / (d.store.salesCount + d.store.cancelledCount)) * 100).toFixed(1) : "0"}%</strong>
          </span>
        </section>
      ) : null}
    </div>
  );
}
