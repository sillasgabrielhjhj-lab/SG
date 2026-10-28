import { ArrowRight, Heart, Target } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign } from "@/config/campaign";
import { coverPhoto } from "@/content/photos";
import type { FundraisingView } from "@/lib/fundraising";
import { formatPercent } from "@/lib/fundraising/progress";
import { formatBRL } from "@/lib/money";
import { GoalBar } from "./GoalBar";
import { ShareCampaignButton } from "./ShareCampaignButton";

/** Resumo da meta dentro do card; sem dados configurados, mostra só o objetivo (nenhum número). */
function CardGoal({ view }: { view: FundraisingView }) {
  switch (view.kind) {
    case "progress":
      return (
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <strong className="font-display text-3xl font-semibold text-ink">
              {formatBRL(view.progress.raisedCents)}
            </strong>
            <span className="text-sm text-muted">
              arrecadados de {formatBRL(view.progress.goalCents)}
            </span>
          </p>
          <GoalBar progress={view.progress} size="md" />
          <p className="mt-2 text-sm font-semibold text-petal-800">
            {view.progress.reached
              ? "Meta alcançada!"
              : `${formatPercent(view.progress.percentTenths)}% da meta alcançada`}
          </p>
        </div>
      );
    case "goal-only":
      return (
        <p className="inline-flex items-center gap-2 rounded-full bg-petal-50 px-4 py-2 text-sm font-bold text-petal-800 ring-1 ring-petal-100">
          <Target aria-hidden className="size-4" /> Meta: {formatBRL(view.goalCents)}
        </p>
      );
    case "raised-only":
      return (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <strong className="font-display text-3xl font-semibold text-ink">
            {formatBRL(view.raisedCents)}
          </strong>
          <span className="text-sm text-muted">arrecadados até agora</span>
        </p>
      );
    case "objective":
      return (
        <p className="flex items-start gap-2.5 rounded-2xl bg-petal-50 p-4 text-sm leading-relaxed text-petal-900 ring-1 ring-petal-100">
          <Heart aria-hidden className="mt-0.5 size-4 shrink-0 fill-heart text-heart" />
          Objetivo: apoiar os cuidados e o acompanhamento da May. Toda contribuição, de qualquer
          valor, faz parte dessa caminhada.
        </p>
      );
  }
}

/** Card da vaquinha: o card inteiro (foto incluída) leva à página de doação. */
export function CampaignCard({ view, siteUrl }: { view: FundraisingView; siteUrl: string }) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-petal-100 transition duration-300 focus-within:ring-2 focus-within:ring-lilac-500 hover:-translate-y-1">
      <div className="relative aspect-[16/10] overflow-hidden">
        <PhotoFrame
          photo={coverPhoto}
          index={2}
          sizes="(min-width: 1024px) 420px, 100vw"
          className="transition duration-700 group-hover:scale-105"
        />
        <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3.5 py-1.5 text-[0.7rem] font-extrabold tracking-[0.14em] text-petal-800 shadow-sm backdrop-blur">
          VAQUINHA SOLIDÁRIA
        </span>
      </div>
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <div>
          <h2 id="vaquinha-titulo" className="text-[1.65rem] leading-tight font-semibold text-ink">
            {campaign.title}
          </h2>
          <p className="mt-2.5 leading-relaxed text-muted">{campaign.description}</p>
        </div>
        <CardGoal view={view} />
        {/* Link "esticado": o ::after cobre o card inteiro. O visual de botão fica no <span>
            interno, pois transform no <a> encolheria a área clicável. */}
        <Link href="/doar" className="block after:absolute after:inset-0 after:content-['']">
          <span className={btn({ size: "lg", className: "w-full" })}>
            DOAR AGORA
            <ArrowRight aria-hidden className="size-5 transition group-hover:translate-x-1" />
          </span>
        </Link>
        <ShareCampaignButton url={siteUrl} />
      </div>
    </article>
  );
}
