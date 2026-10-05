import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, change, hint, icon, className }: { label: string; value: ReactNode; change?: number | null; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className={cn("flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg-muted">{label}</span>
        {icon ? <span className="grid size-8 place-items-center rounded-md bg-brand-50 text-brand-700 [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-fg tabular">{value}</div>
      <div className="flex min-h-5 items-center gap-2 text-xs">
        {change !== undefined && change !== null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", positive ? "text-success-700" : "text-danger-700")}>
            {positive ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {positive ? "+" : ""}
            {change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            <span className="sr-only">em relação ao período anterior</span>
          </span>
        ) : null}
        {hint ? <span className="text-fg-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}
