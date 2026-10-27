import { Heart, Info, Target } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { btn } from "@/components/ui/button";
import { sourceCaption, type FundraisingSnapshot } from "@/lib/fundraising";
import { formatDateBR, supportMessage } from "@/lib/fundraising/messages";
import { barWidthPercent, computeGoalProgress, formatPercent } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";

/**
 * Card da meta de arrecadação. Server Component: o HTML já sai pronto e a animação da barra é CSS
 * puro (começa sozinha ao carregar e é desligada com "reduzir movimento"). Todos os números são
 * calculados a partir de src/config/fundraising.ts; nada aqui reage a ações do visitante.
 */
export function GoalCard({ snapshot }: { snapshot: FundraisingSnapshot }) {
  const progress = computeGoalProgress(snapshot);
  if (!progress) return null;

  const percent = formatPercent(progress.percentTenths);
  const width = barWidthPercent(progress);
  const raised = formatBRL(progress.raisedCents);
  const goal = formatBRL(progress.goalCents);
  const exceeded = progress.raisedCents - progress.goalCents;
  const updatedAt = snapshot.updatedAt ? formatDateBR(snapshot.updatedAt) : undefined;

  return (
    <section
      aria-labelledby="meta-titulo"
      className="relative overflow-hidden rounded-[2rem] bg-white p-5 shadow-lift ring-1 ring-brand-100 sm:p-8 lg:p-10"
    >
      <Heart
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-12 size-64 rotate-12 fill-brand-50 text-brand-100"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-20 size-72 rounded-full bg-brand-100/70 blur-3xl"
      />

      <div className="relative grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blush">
              <Heart aria-hidden className="size-5 animate-beat fill-heart text-heart" />
            </span>
            <h2
              id="meta-titulo"
              className="font-display text-lg font-black tracking-tight text-brand-950 sm:text-xl"
            >
              TODOS PELO TOBIAS<span className="sr-only"> — meta de arrecadação</span>
            </h2>
          </div>

          <p className="mt-5">
            <span className="block font-display text-[2.6rem] leading-none font-black tracking-tight text-brand-700 sm:text-5xl lg:text-[3.4rem]">
              {raised}
            </span>
            <span className="mt-2 block text-base font-semibold text-brand-900">arrecadados</span>
          </p>

          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-800 ring-1 ring-brand-100">
            <Target aria-hidden className="size-4 text-brand-600" />
            Nossa meta: {goal}
          </p>
        </div>

        <div>
          <div
            className="relative mt-9 lg:mt-10"
            style={{ "--goal-progress": `${width}%` } as CSSProperties}
          >
            <div
              role="progressbar"
              aria-label="Progresso da meta de arrecadação"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={width}
              aria-valuetext={`${percent}% da meta: ${raised} de ${goal}`}
              className="h-4 w-full rounded-full bg-gray-200 shadow-[inset_0_1px_2px_rgb(0_0_0/0.1)] sm:h-5"
            >
              <div className="goal-sheen h-full w-[var(--goal-progress)] animate-goal-fill rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 shadow-[inset_0_2px_3px_rgb(255_255_255/0.35),inset_0_-2px_3px_rgb(0_0_0/0.12)]" />
            </div>
            <span
              aria-hidden
              className="absolute bottom-full goal-badge-pos mb-2.5 -translate-x-1/2 animate-goal-badge rounded-full bg-brand-900 px-3 py-1 text-xs font-extrabold text-white shadow-md after:absolute after:top-full after:left-1/2 after:-mt-1 after:size-2 after:-translate-x-1/2 after:rotate-45 after:bg-brand-900 after:content-['']"
            >
              {percent}%
            </span>
          </div>

          <p className="mt-4 font-display text-2xl leading-tight font-extrabold text-brand-800 sm:text-[1.7rem]">
            {progress.reached ? "Meta alcançada!" : `${percent}% da meta alcançada!`}
          </p>
          <p className="mt-1.5 leading-relaxed text-muted">
            {progress.reached ? (
              exceeded > 0 ? (
                <>
                  Ultrapassamos a meta em{" "}
                  <strong className="text-brand-900">{formatBRL(exceeded)}</strong>. Muito obrigado!
                </>
              ) : (
                "Chegamos ao nosso objetivo. Muito obrigado!"
              )
            ) : (
              <>
                Faltam{" "}
                <strong className="text-brand-900">{formatBRL(progress.remainingCents)}</strong>{" "}
                para alcançarmos nosso objetivo.
              </>
            )}
          </p>

          <Link href="/doar" className={btn({ size: "lg", className: "shine mt-6 w-full" })}>
            <Heart aria-hidden className="size-5 fill-current" />
            AJUDAR O TOBIAS AGORA
          </Link>
        </div>
      </div>

      <div className="relative mt-7 grid gap-4 border-t border-brand-100 pt-6 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:gap-10">
        <p className="rounded-2xl bg-gradient-to-br from-brand-50 to-blush/60 p-4 leading-relaxed text-brand-900 ring-1 ring-brand-100">
          {supportMessage(progress)}
        </p>
        <p className="flex gap-2.5 text-xs leading-relaxed text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
          {sourceCaption(snapshot.source, updatedAt)}
        </p>
      </div>
    </section>
  );
}
