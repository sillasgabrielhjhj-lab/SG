import { CalendarDays, Package, ShieldCheck, Star } from "lucide-react";
import { formatCompact, formatMembership } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";

/** Cabeçalho de loja com reputação (nota, vendas, cancelamentos, tempo de plataforma). */
export function StoreHeader({ store, children }: { store: { name: string; description: string | null; isOfficial: boolean; ratingAvg: number; ratingCount: number; salesCount: number; cancellationRate: number; createdAt: Date; productCount: number; originCity?: string | null; originState?: string | null }; children?: React.ReactNode }) {
  const reputation = store.ratingCount === 0 ? "Nova" : store.ratingAvg >= 4.5 && store.cancellationRate < 0.03 ? "Excelente" : store.ratingAvg >= 4 ? "Muito boa" : store.ratingAvg >= 3 ? "Boa" : "Regular";
  return (
    <section className={cn("overflow-hidden rounded-panel border", store.isOfficial ? "border-brand-900 bg-brand-800 text-white" : "border-line bg-surface")}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className={cn("grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold", store.isOfficial ? "bg-white text-brand-800" : "bg-brand-50 text-brand-800")}>{store.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{store.name}</h1>
            {store.isOfficial ? <OfficialBadge className="bg-white/15" /> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><ShieldCheck className="size-4" aria-hidden /> Loja verificada</span>}
          </div>
          {store.description ? <p className={cn("mt-1 text-sm", store.isOfficial ? "text-white/85" : "text-fg-muted")}>{store.description}</p> : null}
        </div>
        {children}
      </div>
      <dl className={cn("grid grid-cols-2 gap-px text-sm sm:grid-cols-3", store.isOfficial ? "bg-white/10" : "bg-line")}>
        {[
          [Star, "Reputação", store.ratingCount ? <span key="r" className="flex items-center gap-1.5">{reputation} <RatingStars value={store.ratingAvg} size="xs" /></span> : "Nova loja"],
          [Package, "Vendas", `+${formatCompact(store.salesCount)}`],
          [CalendarDays, "Na plataforma", formatMembership(store.createdAt).replace(" na Mercatto", "")],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Star;
          return (
            <div key={String(label)} className={cn("flex items-center gap-2.5 px-5 py-3", store.isOfficial ? "bg-brand-800" : "bg-surface")}>
              <I className={cn("size-4 shrink-0", store.isOfficial ? "text-sun-300" : "text-brand-700")} aria-hidden />
              <div>
                <dt className={cn("text-xs", store.isOfficial ? "text-white/70" : "text-fg-subtle")}>{String(label)}</dt>
                <dd className="font-semibold">{value as React.ReactNode}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
