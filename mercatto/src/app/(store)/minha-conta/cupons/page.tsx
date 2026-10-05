import Link from "next/link";
import { Ticket } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listPublicCoupons } from "@/features/coupons/service";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Cupons" };

export default async function CouponsPage() {
  const user = await requireUserPage("/minha-conta/cupons");
  const coupons = await listPublicCoupons(user.id);
  return (
    <div>
      <PageHeading title="Cupons" description="Copie o código e aplique no carrinho. Cupons não se somam a outros cupons." />
      {coupons.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Ticket />} title="Nenhum cupom disponível agora" description="Fique de olho: novas campanhas trazem cupons exclusivos." />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {coupons.map((c) => (
            <li key={c.id} className={cn("relative flex overflow-hidden rounded-card border bg-surface", c.usable ? "border-brand-200" : "border-line opacity-75")}>
              <div className={cn("flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r-2 border-dashed p-3 text-center", c.usable ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line bg-surface-muted text-fg-subtle")}>
                <Ticket className="size-6" aria-hidden />
                <span className="text-xs leading-tight font-extrabold">{c.benefit}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-sm font-bold tracking-wide">{c.code}</code>
                  {c.usable ? <CopyButton value={c.code} size="sm" variant="ghost" label="Copiar código" /> : <span className="text-xs font-semibold text-fg-muted">{c.reason}</span>}
                </div>
                {c.description ? <p className="text-sm text-fg">{c.description}</p> : null}
                <ul className="flex flex-col gap-0.5 text-xs text-fg-muted">
                  {c.minOrderCents > 0 ? <li>Compra mínima de {formatBRL(c.minOrderCents)}</li> : null}
                  {c.firstPurchaseOnly ? <li>Válido somente na primeira compra</li> : null}
                  {c.storeName ? (
                    <li>
                      Válido na loja{" "}
                      <Link href={`/loja/${c.storeSlug}`} className="font-semibold text-brand-700 hover:underline">
                        {c.storeName}
                      </Link>
                    </li>
                  ) : (
                    <li>Válido em todo o site</li>
                  )}
                  {c.endsAt ? <li>Válido até {formatDateTime(c.endsAt)}</li> : null}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
