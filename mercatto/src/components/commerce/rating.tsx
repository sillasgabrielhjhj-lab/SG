import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";

/** Estrelas de avaliação (com meia estrela) — leitura acessível "Nota 4,5 de 5". */
export function RatingStars({ value, count, size = "sm", className, showValue = false }: { value: number; count?: number; size?: "xs" | "sm" | "md" | "lg"; className?: string; showValue?: boolean }) {
  const px = { xs: "size-3", sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  const label = `Nota ${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5${count !== undefined ? `, ${count} avaliações` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={label}>
      {showValue ? <span className="text-sm font-semibold text-fg tabular">{value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> : null}
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          return (
            <span key={i} className={cn("relative", px)}>
              <Star className={cn("absolute inset-0 text-line-strong", px)} fill="currentColor" strokeWidth={0} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn("text-sun-500", px)} fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          );
        })}
      </span>
      {count !== undefined ? <span className="text-xs text-fg-subtle tabular">({formatCompact(count)})</span> : null}
    </span>
  );
}
