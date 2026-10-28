import { Heart, Info } from "lucide-react";
import { GoalBar } from "@/components/home/GoalBar";
import { sourceCaption, type FundraisingSnapshot } from "@/lib/fundraising";
import { formatDateBR } from "@/lib/fundraising/messages";
import { formatPercent, type GoalProgress } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";

/** Versão compacta da meta, na página de doação (mesma configuração da página inicial). */
export function GoalCompact({
  progress,
  snapshot,
}: {
  progress: GoalProgress;
  snapshot: FundraisingSnapshot;
}) {
  const updatedAt = snapshot.updatedAt ? formatDateBR(snapshot.updatedAt) : undefined;

  return (
    <section
      aria-labelledby="meta-doar-titulo"
      className="mb-6 rounded-[1.75rem] bg-white p-5 shadow-soft ring-1 ring-petal-100 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            id="meta-doar-titulo"
            className="flex items-center gap-2 font-sans text-xs font-extrabold tracking-[0.16em] text-petal-700 uppercase"
          >
            <Heart aria-hidden className="size-3.5 fill-heart text-heart" />
            Nossa meta
          </h2>
          <p className="mt-1.5">
            <strong className="font-display text-[1.75rem] font-semibold text-ink lining-nums tabular-nums">
              {formatBRL(progress.raisedCents)}
            </strong>{" "}
            <span className="text-sm text-muted">
              arrecadados de {formatBRL(progress.goalCents)}
            </span>
          </p>
        </div>
        <p className="font-bold text-petal-800">
          {progress.reached
            ? "Meta alcançada!"
            : `${formatPercent(progress.percentTenths)}% alcançado`}
        </p>
      </div>
      <div className="mt-3">
        <GoalBar progress={progress} size="md" animate="load" badge={false} />
      </div>
      {progress.reached ? null : (
        <p className="mt-3 text-sm text-muted">
          Faltam <strong className="text-ink">{formatBRL(progress.remainingCents)}</strong> para
          alcançarmos nosso objetivo.
        </p>
      )}
      <p className="mt-2 flex gap-2 text-xs leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-lilac-700" />
        {sourceCaption(snapshot.source, updatedAt)}
      </p>
    </section>
  );
}
