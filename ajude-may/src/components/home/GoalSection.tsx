import { Heart, Info } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { fundraisingView, sourceCaption, type FundraisingSnapshot } from "@/lib/fundraising";
import { formatDateBR, supportMessage } from "@/lib/fundraising/messages";
import { formatPercent } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";
import { GoalBar } from "./GoalBar";

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-ivory p-5 ring-1 ring-petal-100">
      <dt className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd
        className={`mt-2 font-display text-2xl font-semibold lining-nums sm:text-[1.7rem] ${accent ? "text-petal-700" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * "Nossa meta": acompanha a arrecadação com os valores de src/config/fundraising.ts. Sem valores
 * configurados, mostra só o objetivo da campanha e o botão de doação — nenhum número inventado.
 */
export function GoalSection({ snapshot }: { snapshot: FundraisingSnapshot }) {
  const view = fundraisingView(snapshot);
  const updatedAt = snapshot.updatedAt ? formatDateBR(snapshot.updatedAt) : undefined;
  const hasNumbers = view.kind !== "objective";

  return (
    <section id="meta" aria-labelledby="meta-titulo" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading eyebrow="Nossa meta" title="Juntos pela caminhada da May" id="meta-titulo">
          As doações têm o objetivo de apoiar os cuidados e o acompanhamento da May.
        </SectionHeading>

        <Reveal className="mt-12">
          <div className="relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-petal-100 sm:p-10">
            <Heart
              aria-hidden
              className="pointer-events-none absolute -right-10 -bottom-14 size-64 rotate-12 fill-petal-50 text-petal-100"
            />

            {view.kind === "progress" ? (
              <div className="relative">
                <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <Stat label="Arrecadado" value={formatBRL(view.progress.raisedCents)} accent />
                  <Stat label="Meta total" value={formatBRL(view.progress.goalCents)} />
                  <Stat
                    label="Alcançado"
                    value={`${formatPercent(view.progress.percentTenths)}%`}
                  />
                  <Stat
                    label={view.progress.reached ? "Restante" : "Faltam"}
                    value={formatBRL(view.progress.remainingCents)}
                  />
                </dl>
                <div className="mt-6">
                  <GoalBar progress={view.progress} />
                </div>
                <p className="mt-5 rounded-2xl bg-gradient-to-br from-petal-50 to-lilac-50 p-4 leading-relaxed text-petal-950 ring-1 ring-petal-100">
                  {supportMessage(view.progress)}
                </p>
              </div>
            ) : view.kind === "goal-only" ? (
              <dl className="relative grid gap-4 sm:grid-cols-2">
                <Stat label="Meta total" value={formatBRL(view.goalCents)} accent />
                <div className="flex items-center rounded-3xl p-2 leading-relaxed text-muted">
                  O valor arrecadado será atualizado pelos responsáveis conforme as doações forem
                  conferidas.
                </div>
              </dl>
            ) : view.kind === "raised-only" ? (
              <dl className="relative grid gap-4 sm:max-w-xs">
                <Stat label="Arrecadado até agora" value={formatBRL(view.raisedCents)} accent />
              </dl>
            ) : (
              <div className="relative mx-auto max-w-2xl text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-petal-50 ring-1 ring-petal-100">
                  <Heart aria-hidden className="size-6 animate-beat fill-heart text-heart" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-ink sm:text-3xl">Nosso objetivo</h3>
                <p className="mt-3 text-lg leading-relaxed text-muted">
                  Reunir apoio para que a May tenha mais conforto, segurança e qualidade de vida,
                  com os cuidados constantes e o acompanhamento de que precisa. Toda contribuição,
                  de qualquer valor, faz parte dessa caminhada.
                </p>
              </div>
            )}

            <div
              className={`relative mt-8 flex flex-col gap-5 ${hasNumbers ? "lg:flex-row lg:items-center lg:justify-between" : "items-center"}`}
            >
              <Link
                href="/doar"
                className={btn({ size: "lg", className: "shine w-full sm:w-auto" })}
              >
                <Heart aria-hidden className="size-5 fill-current" />
                AJUDAR A MAY AGORA
              </Link>
              {hasNumbers ? (
                <p className="flex gap-2.5 text-xs leading-relaxed text-muted lg:max-w-md">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac-700" />
                  {sourceCaption(snapshot.source, updatedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
