import Link from "next/link";
import { Boxes, Search } from "lucide-react";
import { getStoreSettings } from "@/features/settings/queries";
import { listMovements, listStockVariants, type StockScope } from "@/features/inventory/service";
import { StockAdjustButton } from "@/features/inventory/components/stock-adjust";
import { ProductImage } from "@/components/commerce/product-image";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = { IN: "Entrada", OUT: "Saída", SALE: "Venda", CANCELLATION: "Cancelamento", ADJUSTMENT: "Ajuste", RETURN: "Devolução" };

/** Tela de estoque (vendedor/admin): saldos por variação + histórico de movimentações. */
export async function StockView({ scope, mode, basePath, productBasePath, searchParams }: { scope: StockScope; mode: "seller" | "admin"; basePath: string; productBasePath: string; searchParams: Record<string, string | undefined> }) {
  const tab = searchParams.aba === "historico" ? "historico" : "saldos";
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const q = searchParams.q?.trim().slice(0, 80) || undefined;
  const lowOnly = searchParams.baixo === "1";
  const settings = await getStoreSettings();
  const threshold = settings.lowStockThreshold;

  const tabs = (
    <nav aria-label="Estoque" className="mb-4 inline-flex rounded-field border border-line bg-surface p-1">
      {[
        ["saldos", "Saldos"],
        ["historico", "Histórico"],
      ].map(([id, label]) => (
        <Link key={id} href={id === "saldos" ? basePath : `${basePath}?aba=historico`} aria-current={tab === id ? "page" : undefined} className={cn("rounded-md px-4 py-1.5 text-sm font-semibold focus-ring", tab === id ? "bg-brand-700 text-white" : "text-fg-muted hover:text-fg")}>
          {label}
        </Link>
      ))}
    </nav>
  );

  if (tab === "historico") {
    const data = await listMovements(scope, { page });
    return (
      <div>
        <PageHeading title="Estoque" description="Toda movimentação fica registrada com responsável e motivo." />
        {tabs}
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-3 py-3">Produto / SKU</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3 text-right">Qtd.</th>
                <th className="px-3 py-3 text-right">Saldo</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-fg-muted">{formatDateTime(m.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <p className="line-clamp-1 font-medium">{m.variant.product.name}</p>
                    <p className="font-mono text-xs text-fg-muted">
                      {m.variant.sku} · {m.variant.name}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{TYPE_LABEL[m.type] ?? m.type}</td>
                  <td className={cn("px-3 py-2.5 text-right font-semibold tabular", m.quantity < 0 ? "text-danger-700" : "text-success-700")}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular">{m.balanceAfter}</td>
                  <td className="max-w-56 px-3 py-2.5 text-xs text-fg-muted">
                    {m.reason}
                    {m.order ? ` · Pedido ${m.order.number}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{m.actor?.name ?? "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 ? <p className="p-6 text-center text-sm text-fg-muted">Nenhuma movimentação registrada.</p> : null}
        </div>
        <Pagination className="mt-6" page={page} totalPages={data.totalPages} buildHref={(p) => `${basePath}?aba=historico${p > 1 ? `&pagina=${p}` : ""}`} />
      </div>
    );
  }

  const data = await listStockVariants(scope, { q, lowOnly, lowThreshold: threshold, page });
  return (
    <div>
      <PageHeading title="Estoque" description={`Alerta de estoque baixo: até ${threshold} unidades ou o mínimo definido na variação.`} />
      {tabs}
      <form method="get" action={basePath} className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar por produto ou SKU</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Produto ou SKU" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-field border border-line-strong bg-surface px-3 text-sm">
          <input type="checkbox" name="baixo" value="1" defaultChecked={lowOnly} className="size-4 accent-brand-700" /> Somente estoque baixo
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Filtrar
        </button>
      </form>
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Boxes />} title={lowOnly ? "Nenhuma variação com estoque baixo" : "Nenhuma variação encontrada"} />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {data.items.map((v) => {
            const low = v.stock <= Math.max(v.minStock, threshold);
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                  <ProductImage src={v.product.images[0]?.url ?? null} alt="" sizes="48px" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`${productBasePath}/${v.product.id}#variacoes`} className="line-clamp-1 text-sm font-semibold hover:underline">
                    {v.product.name}
                  </Link>
                  <p className="text-xs text-fg-muted">
                    <span className="font-mono">{v.sku}</span> · {v.name}
                    {mode === "admin" ? ` · ${v.product.store.name}` : ""}
                    {v.status === "INACTIVE" ? " · inativa" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-extrabold tabular", v.stock === 0 ? "text-danger-700" : low ? "text-warning-700" : "text-fg")}>{v.stock}</p>
                  <p className="text-2xs text-fg-subtle">mín. {v.minStock}</p>
                </div>
                <StockAdjustButton mode={mode} variant={{ id: v.id, label: `${v.product.name} — ${v.name} (${v.sku})`, stock: v.stock, minStock: v.minStock }} />
              </li>
            );
          })}
        </ul>
      )}
      {!lowOnly ? <Pagination className="mt-6" page={page} totalPages={data.totalPages} buildHref={(p) => `${basePath}?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { pagina: String(p) } : {}) }).toString()}`} /> : null}
    </div>
  );
}
