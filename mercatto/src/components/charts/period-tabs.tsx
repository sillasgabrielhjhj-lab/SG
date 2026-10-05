import Link from "next/link";
import { cn } from "@/lib/utils";

/** Seletor de período (7/30/90 dias) refletido na URL. */
export function PeriodTabs({ current, basePath }: { current: number; basePath: string }) {
  return (
    <nav aria-label="Período" className="inline-flex rounded-field border border-line bg-surface p-1">
      {[7, 30, 90].map((d) => (
        <Link key={d} href={d === 30 ? basePath : `${basePath}?periodo=${d}`} aria-current={current === d ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold focus-ring", current === d ? "bg-brand-700 text-white" : "text-fg-muted hover:text-fg")}>
          {d} dias
        </Link>
      ))}
    </nav>
  );
}
