import { Heart, Info, Target } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui/button";
import { sourceCaption, type FundraisingSnapshot } from "@/lib/fundraising";
import { formatDateBR, supportMessage } from "@/lib/fundraising/messages";
import { formatPercent, type GoalProgress } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";
import { CountUp } from "./CountUp";
import { GoalBar } from "./GoalBar";

/**
 * Meta em destaque logo abaixo do banner. Server Component: todos os números saem prontos no HTML,
 * calculados a partir de src/config/fundraising.ts; nada aqui reage a ações do visitante.
 */
export function GoalHighlight({
  progress,
  snapshot,
}: {
  progress: GoalProgress;
  snapshot: FundraisingSnapshot;
}) {
  const percent = formatPercent(progress.percentTenths);
  const updatedAt = snapshot.updatedAt ? formatDateBR(snapshot.updatedAt) : undefined;

  return (
    <section
      id="arrecadacao"
      aria-labelledby="arrecadacao-titulo"
      className="relative scroll-mt-24 overflow-hidden rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-petal-100 sm:p-9 lg:p-11"
    >
      <div
        aria-hidden
        className="absolute -top-24 -left-20 size-72 rounded-full bg-petal-100/80 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -right-16 -bottom-24 size-72 rounded-full bg-lilac-100 blur-3xl"
      />
      <Heart
        aria-hidden
        strokeWidth={1.25}
        className="absolute top-6 right-6 hidden size-24 rotate-12 fill-petal-50 text-petal-200 sm:block"
      />

      <div className="relative grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:gap-14">
        <div>
          <h2
            id="arrecadacao-titulo"
            className="flex items-center gap-2.5 font-sans text-sm font-extrabold tracking-[0.16em] text-petal-700 uppercase"
          >
            <Heart aria-hidden className="size-4 animate-beat fill-heart text-heart" />
            Ajude May nessa caminhada
          </h2>
          <p className="mt-5">
            <CountUp
              cents={progress.raisedCents}
              className="block font-display text-[2.4rem] leading-none font-semibold tracking-tight text-ink lining-nums tabular-nums sm:text-6xl"
            />
            <span className="mt-2.5 block text-lg font-semibold text-petal-800">
              já arrecadados
            </span>
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-lilac-50 px-4 py-2 font-bold text-lilac-900 ring-1 ring-lilac-200">
            <Target aria-hidden className="size-4 text-lilac-600" />
            Meta: {formatBRL(progress.goalCents)}
          </p>
        </div>

        <div>
          <p className="font-display text-2xl leading-tight font-semibold text-ink lining-nums sm:text-[1.9rem]">
            {progress.reached
              ? "Nossa meta foi alcançada!"
              : `${percent}% da nossa meta alcançada!`}
          </p>
          <p className="mt-2 text-lg leading-relaxed text-muted">
            {progress.reached ? (
              "Muito obrigado a todos que caminharam com a May."
            ) : (
              <>
                Faltam{" "}
                <strong className="font-bold text-ink">{formatBRL(progress.remainingCents)}</strong>{" "}
                para alcançarmos nosso objetivo.
              </>
            )}
          </p>
          <div className="mt-2">
            <GoalBar progress={progress} animate="load" />
          </div>
        </div>
      </div>

      <p className="relative mt-8 rounded-2xl bg-gradient-to-br from-petal-50 to-lilac-50 p-5 leading-relaxed text-petal-950 ring-1 ring-petal-100 sm:text-lg">
        {supportMessage(progress)}
      </p>

      <div className="relative mt-7 flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
        <Link
          href="/doar"
          className={btn({ size: "lg", className: "shine w-full lg:w-auto lg:px-12" })}
        >
          <Heart aria-hidden className="size-5 fill-current" />
          FAZER MINHA DOAÇÃO
        </Link>
        <p className="flex gap-2 text-xs leading-relaxed text-muted lg:max-w-md">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac-700" />
          {sourceCaption(snapshot.source, updatedAt)}
        </p>
      </div>
    </section>
  );
}
