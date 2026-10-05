import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listPaymentsAdmin } from "@/features/admin/queries";
import { PageHeading } from "@/components/layout/page-heading";
import { FilterTabs, buildHref } from "@/components/layout/filter-tabs";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Pagamentos" };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pendente", tone: "warning" },
  AUTHORIZED: { label: "Autorizado", tone: "info" },
  PAID: { label: "Pago", tone: "success" },
  FAILED: { label: "Recusado", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Reemb. parcial", tone: "warning" },
};

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; metodo?: string; pagina?: string }> }) {
  await requirePermissionPage("admin:payments", "/admin/pagamentos");
  const sp = await searchParams;
  const status = sp.status && sp.status in STATUS ? sp.status : undefined;
  const method = sp.metodo === "PIX" || sp.metodo === "CREDIT_CARD" ? sp.metodo : undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const data = await listPaymentsAdmin({ status, method, page });
  const counts = Object.fromEntries(data.byStatus.map((s) => [s.status, s._count._all]));
  const href = (p: Record<string, string | number | undefined>) => buildHref("/admin/pagamentos", { status, metodo: method, ...p });

  return (
    <div>
      <PageHeading title="Pagamentos" description="Transações do gateway. Nenhum dado completo de cartão é armazenado." />
      <FilterTabs label="Status do pagamento" items={[{ label: "Todos", href: href({ status: undefined }), active: !status }, ...Object.entries(STATUS).map(([k, v]) => ({ label: v.label, href: href({ status: k, pagina: undefined }), active: status === k, count: counts[k] }))]} />
      <FilterTabs label="Método" items={[{ label: "Todos os métodos", href: href({ metodo: undefined }), active: !method }, { label: "PIX", href: href({ metodo: "PIX" }), active: method === "PIX" }, { label: "Cartão", href: href({ metodo: "CREDIT_CARD" }), active: method === "CREDIT_CARD" }]} />
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<CreditCard />} title="Nenhum pagamento encontrado" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-3 py-3">Pedido(s)</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Método</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3 text-right">Reembolsado</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">ID no gateway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-fg-muted">{formatDateTime(p.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    {p.checkout.orders.map((o) => (
                      <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="block font-semibold text-brand-700 hover:underline">
                        {o.number}
                      </Link>
                    ))}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block">{p.checkout.user.name}</span>
                    <span className="block text-xs text-fg-muted">{p.checkout.user.email}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.method === "PIX" ? "PIX" : `${p.cardBrand ?? "Cartão"}${p.cardLast4 ? ` •••• ${p.cardLast4}` : ""}`}
                    {p.method === "CREDIT_CARD" && p.installments > 1 ? <span className="text-fg-muted"> · {p.installments}x</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular">{formatBRL(p.amountCents)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{p.refundedCents ? formatBRL(p.refundedCents) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={STATUS[p.status]?.tone ?? "neutral"} size="xs">
                        {STATUS[p.status]?.label ?? p.status}
                      </Badge>
                      {p.isSandbox ? (
                        <Badge tone="outline" size="xs">
                          Sandbox
                        </Badge>
                      ) : null}
                    </div>
                    {p.failureReason ? <p className="mt-1 max-w-48 text-xs text-danger-700">{p.failureReason}</p> : null}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 font-mono text-xs text-fg-muted" title={p.providerPaymentId ?? undefined}>
                    {p.provider} · {p.providerPaymentId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
