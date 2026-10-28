import type { CSSProperties } from "react";
import { barWidthPercent, formatPercent, type GoalProgress } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Barra de progresso acessível e proporcional ao valor real. Ela se preenche de 0 até o valor:
 * dentro de um <Reveal>, quando entra na tela; com `animate="load"`, ao carregar a página. Com
 * "reduzir movimento", já aparece no valor final.
 */
export function GoalBar({
  progress,
  size = "lg",
  animate = "reveal",
  badge = true,
}: {
  progress: GoalProgress;
  size?: "md" | "lg";
  animate?: "reveal" | "load";
  /** Selo com a porcentagem acompanhando a ponta da barra. */
  badge?: boolean;
}) {
  const percent = formatPercent(progress.percentTenths);
  const width = barWidthPercent(progress);

  return (
    <div
      className={cn("relative", badge && "pt-9", animate === "load" && "goal-load")}
      style={{ "--goal-progress": `${width}%` } as CSSProperties}
    >
      <div
        role="progressbar"
        aria-label="Progresso da meta de arrecadação"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${percent}% da meta: ${formatBRL(progress.raisedCents)} de ${formatBRL(progress.goalCents)}`}
        className={cn(
          "w-full rounded-full bg-petal-100 shadow-[inset_0_1px_2px_rgb(111_37_65/0.12)]",
          size === "lg" ? "h-4 sm:h-5" : "h-3",
        )}
      >
        <div className="goal-fill h-full w-[var(--goal-progress)] rounded-full bg-gradient-to-r from-petal-400 via-petal-500 to-lilac-500 shadow-[inset_0_2px_3px_rgb(255_255_255/0.35)]" />
      </div>
      {badge ? (
        <span
          aria-hidden
          className="goal-badge absolute top-0 goal-badge-pos -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-xs font-extrabold text-white shadow-md after:absolute after:top-full after:left-1/2 after:-mt-1 after:size-2 after:-translate-x-1/2 after:rotate-45 after:bg-ink after:content-['']"
        >
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
