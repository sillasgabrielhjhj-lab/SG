import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgePercent, Boxes, CreditCard, Eye, MessageSquareWarning, Package, Receipt, RotateCcw, ShoppingBag, Store, Ticket, Users, Webhook } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { getAdminDashboard } from "@/features/metrics/dashboards";
import type { MetricsPeriod } from "@/features/metrics/core";
import { SalesChart, RankBars } from "@/components/charts/sales-chart";
import { PeriodTabs } from "@/components/charts/period-tabs";
import { ProductImage } from "@/components/commerce/product-image";
import { PageHeading } from "@/components/layout/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/money";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Visão geral" };

const parsePeriod = (v?: string): MetricsPeriod => (v === "7" ? 7 : v === "90" ? 90 : 30);
const PAYMENT_STATUS: Record<string, string> = { PENDING: "Pendentes", AUTHORIZED: "Autorizados", PAID: "Pagos", FAILED: "Recusados", CANCELLED: "Cancelados", EXPIRED: "Expirados", REFUNDED: "Reembolsados", PARTIALLY_REFUNDED: "Reemb. parcial" };

function Alerts({ items }: { items: { show: boolean; href: string; text: string; tone: "warning" | "danger" | "info"; icon: React.ReactNode }[] }) {
  const visible = items.filter((i) => i.show);
  if (!visible.length) return <p className="rounded-card border border-success-600/30 bg-success-50 p-3 text-sm font-semibold text-success-700">Nenhuma pendência operacional no momento.</p>;
  const tones = { warning: "border-warning-600/30 bg-warning-50 text-warning-700", danger: "border-danger-600/30 bg-danger-50 text-danger-700", info: "border-info-600/30 bg-info-50 text-info-700" };
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((a) => (
        <li key={a.href + a.text}>
          <Link href={a.href} className={`flex items-center gap-3 rounded-card border p-3 text-sm hover:shadow-raised focus-ring ${tones[a.tone]} [&_svg]:size-5`}>
            {a.icon}
            <span className="flex-1 font-semibold">{a.text}</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requirePermissionPage("admin:access", "/admin");
  const days = parsePeriod((await searchParams).periodo);
  const canSeeFinance = hasPermission(user.role, "admin:payments");

  if (!canSeeFinance) {
    // Suporte: somente filas operacionais (sem números financeiros).
    const [refundRequests, pendingReviews, pendingQuestions, toShip] = await Promise.all([
      db.order.count({ where: { status: "REFUND_REQUESTED" } }),
      db.review.count({ where: { status: "PENDING" } }),
      db.question.count({ where: { status: "PENDING" } }),
      db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    ]);
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title={`Olá, ${user.name.split(" ")[0]}`} description="Filas de atendimento e moderação." />
        <Alerts
          items={[
            { show: refundRequests > 0, href: "/admin/pedidos?status=REFUND_REQUESTED", text: `${refundRequests} solicitação(ões) de cancelamento/devolução`, tone: "warning", icon: <RotateCcw /> },
            { show: pendingReviews + pendingQuestions > 0, href: "/admin/moderacao", text: `${pendingReviews + pendingQuestions} item(ns) aguardando moderação`, tone: "info", icon: <MessageSquareWarning /> },
            { show: toShip > 0, href: "/admin/pedidos?status=PAID", text: `${toShip} pedido(s) pagos aguardando envio`, tone: "info", icon: <ShoppingBag /> },
          ]}
        />
      </div>
    );
  }

  const [d, refundRequests] = await Promise.all([getAdminDashboard(days), db.order.count({ where: { status: "REFUND_REQUESTED" } })]);
  const k = d.kpis;
  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Visão geral" description="Desempenho do marketplace (oficial + parceiros)." actions={<PeriodTabs current={days} basePath="/admin" />} />

      <Alerts
        items={[
          { show: d.alerts.pendingStores > 0, href: "/admin/vendedores?status=PENDING", text: `${d.alerts.pendingStores} loja(s) aguardando aprovação`, tone: "warning", icon: <Store /> },
          { show: refundRequests > 0, href: "/admin/pedidos?status=REFUND_REQUESTED", text: `${refundRequests} solicitação(ões) de reembolso`, tone: "warning", icon: <RotateCcw /> },
          { show: d.alerts.failedPayments24h > 0, href: "/admin/pagamentos?status=FAILED", text: `${d.alerts.failedPayments24h} pagamento(s) recusado(s) em 24h`, tone: "danger", icon: <CreditCard /> },
          { show: d.alerts.pendingReviews + d.alerts.pendingQuestions > 0, href: "/admin/moderacao", text: `${d.alerts.pendingReviews + d.alerts.pendingQuestions} item(ns) para moderar`, tone: "info", icon: <MessageSquareWarning /> },
          { show: d.alerts.webhookErrors > 0, href: "/admin/pagamentos", text: `${d.alerts.webhookErrors} webhook(s) com erro`, tone: "danger", icon: <Webhook /> },
          { show: d.alerts.lowStock > 0, href: "/admin/estoque?baixo=1", text: `${d.alerts.lowStock} variação(ões) oficiais com estoque baixo`, tone: "warning", icon: <Boxes /> },
          { show: d.alerts.outOfStock > 0, href: "/admin/produtos?status=OUT_OF_STOCK", text: `${d.alerts.outOfStock} produto(s) sem estoque`, tone: "warning", icon: <AlertTriangle /> },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="GMV (vendas)" value={formatBRL(k.gmv.value)} change={k.gmv.change} icon={<Receipt />} />
        <StatCard label="Receita oficial" value={formatBRL(k.officialRevenue.value)} hint="Loja Oficial Mercatto" icon={<BadgePercent />} />
        <StatCard label="Pedidos" value={formatNumber(k.orders.value)} change={k.orders.change} icon={<ShoppingBag />} />
        <StatCard label="Ticket médio" value={formatBRL(k.avgTicket.value)} change={k.avgTicket.change} icon={<Receipt />} />
        <StatCard label="Clientes" value={formatNumber(k.customers.value)} hint={`+${formatNumber(k.customers.newInPeriod)} no período`} icon={<Users />} />
        <StatCard label="Lojas ativas" value={formatNumber(k.sellers.value)} hint={k.sellers.pending ? `${k.sellers.pending} pendente(s)` : undefined} icon={<Store />} />
        <StatCard label="Conversão" value={`${(k.conversion.value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} hint={`${formatNumber(k.conversion.visits)} visitas`} icon={<Eye />} />
        <StatCard label="Produtos ativos" value={formatNumber(k.products.active)} hint={`${k.products.outOfStock} sem estoque`} icon={<Package />} />
      </div>

      <section aria-labelledby="chart" className="rounded-card border border-line bg-surface p-4">
        <h2 id="chart" className="font-bold">
          Vendas por dia
        </h2>
        <SalesChart data={d.series} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="top" className="rounded-card border border-line bg-surface">
          <h2 id="top" className="border-b border-line px-4 py-3 font-bold">
            Produtos mais vendidos
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
                  <Link href={`/admin/produtos/${p.productId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-xs text-fg-muted">{p.units} un.</span>
                  <span className="w-24 text-right text-sm font-bold tabular">{formatBRL(p.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section aria-labelledby="cats" className="rounded-card border border-line bg-surface p-4">
          <h2 id="cats" className="mb-3 font-bold">
            Faturamento por categoria
          </h2>
          {d.categoryRevenue.length ? <RankBars items={d.categoryRevenue.map((c) => ({ label: c.name, value: c.revenueCents }))} formatAs="brl" /> : <p className="text-sm text-fg-muted">Sem vendas no período.</p>}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-bold">Pagamentos aprovados por método</h2>
          {d.payments.byMethod.length ? <RankBars items={d.payments.byMethod.map((m) => ({ label: m.method === "PIX" ? `PIX (${m.count})` : `Cartão (${m.count})`, value: m.amountCents }))} formatAs="brl" /> : <p className="text-sm text-fg-muted">Sem pagamentos no período.</p>}
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-bold">Pagamentos por status</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {d.payments.byStatus.map((s) => (
              <li key={s.status} className="flex justify-between gap-2">
                <Link href={`/admin/pagamentos?status=${s.status}`} className="hover:underline">
                  {PAYMENT_STATUS[s.status] ?? s.status}
                </Link>
                <span className="tabular">
                  {s.count} · {formatBRL(s.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-bold">Marketing e pós-venda</h2>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1.5">
                <Ticket className="size-4 text-brand-700" aria-hidden /> Cupons usados
              </dt>
              <dd className="tabular">
                {d.coupons.redemptions} · −{formatBRL(d.coupons.discountCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1.5">
                <RotateCcw className="size-4 text-brand-700" aria-hidden /> Reembolsos
              </dt>
              <dd className="tabular">
                {d.refunds.count} · {formatBRL(d.refunds.amountCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1.5">
                <BadgePercent className="size-4 text-brand-700" aria-hidden /> Campanhas ativas
              </dt>
              <dd className="tabular">{d.activeCampaigns}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
