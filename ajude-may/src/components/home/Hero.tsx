import { ArrowRight, Heart, Lock, QrCode, Smartphone } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign } from "@/config/campaign";
import { coverPhoto } from "@/content/photos";
import type { FundraisingSnapshot } from "@/lib/fundraising";
import type { GoalProgress } from "@/lib/fundraising/progress";
import { GoalHighlight } from "./GoalHighlight";

const ASSURANCES = [
  { icon: QrCode, text: "Pix com QR Code ou Copia e Cola" },
  { icon: Smartphone, text: "Direto no app do seu banco" },
  { icon: Lock, text: "Não pedimos dados bancários" },
];

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/**
 * Celular: texto, meta em destaque e foto (a meta aparece logo no começo). Desktop: texto e foto
 * lado a lado e a meta logo abaixo do banner.
 */
export function Hero({
  progress,
  snapshot,
}: {
  progress: GoalProgress | null;
  snapshot: FundraisingSnapshot;
}) {
  return (
    <section
      id="inicio"
      aria-labelledby="titulo"
      className="relative isolate scroll-mt-20 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-40 -left-32 -z-10 size-[34rem] rounded-full bg-petal-100 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute top-24 -right-40 -z-10 size-[30rem] rounded-full bg-lilac-100 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-x-16 gap-y-10 px-4 pt-10 pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-y-8 lg:pt-8 lg:pb-20">
        <div className="order-1 text-center lg:text-left">
          <p
            className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-petal-800 shadow-sm ring-1 ring-petal-200"
            style={delay(40)}
          >
            <Heart aria-hidden className="size-3.5 fill-heart text-heart" />
            Campanha solidária
          </p>
          <h1
            id="titulo"
            className="mt-5 animate-fade-up text-[2.55rem] leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl lg:text-[3.2rem]"
            style={delay(120)}
          >
            AJUDE <em className="font-medium text-petal-600">MAY</em>
            <br />
            NESSA CAMINHADA{" "}
            <span aria-hidden className="inline-block animate-beat">
              ❤️
            </span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-lg leading-relaxed text-muted sm:text-xl lg:mx-0 lg:text-lg"
            style={delay(220)}
          >
            {campaign.subtitle}
          </p>
          <div
            className="mt-7 flex animate-fade-up flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            style={delay(320)}
          >
            <Link href="/doar" className={btn({ size: "lg", className: "shine w-full sm:w-auto" })}>
              QUERO AJUDAR A MAY
              <ArrowRight aria-hidden className="size-5" />
            </Link>
            <Link
              href="/#historia"
              className={btn({ variant: "ghost", size: "lg", className: "w-full sm:w-auto" })}
            >
              Conheça a história
            </Link>
          </div>
          <ul
            className="mt-7 hidden animate-fade-up flex-col items-center gap-2.5 text-sm font-semibold text-ink/80 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:hidden lg:justify-start"
            style={delay(420)}
          >
            {ASSURANCES.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon aria-hidden className="size-4 text-sage-600" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative order-3 mx-auto w-full max-w-sm animate-fade-up sm:max-w-md lg:order-2 lg:max-w-[21rem]"
          style={delay(80)}
        >
          <div
            aria-hidden
            className="absolute inset-0 translate-x-4 translate-y-4 arch bg-lilac-200/70 sm:translate-x-6 sm:translate-y-6"
          />
          <div
            aria-hidden
            className="absolute inset-0 -translate-x-3 -translate-y-3 arch border border-petal-300"
          />
          <Link
            href="/doar"
            className="group relative block aspect-[4/5] overflow-hidden arch bg-white shadow-lift ring-[6px] ring-white"
          >
            <PhotoFrame
              photo={coverPhoto}
              decorative
              sizes="(min-width: 1024px) 460px, (min-width: 640px) 448px, 90vw"
              priority
              className="transition duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-x-4 bottom-4 inline-flex items-center justify-center gap-2 rounded-full bg-white/90 px-4 py-2.5 text-sm font-bold text-sage-700 shadow-soft backdrop-blur transition group-hover:bg-white">
              <Heart aria-hidden className="size-4 fill-current" />
              Toque para doar<span className="sr-only"> e ajudar a May</span>
            </span>
          </Link>
          <Heart
            aria-hidden
            className="absolute -top-3 right-2 size-9 animate-float fill-petal-300 text-petal-300 [--r:12deg]"
          />
          <Heart
            aria-hidden
            className="absolute bottom-24 -left-4 size-6 animate-float fill-lilac-300 text-lilac-300 [--r:-14deg] [animation-delay:1.5s]"
          />
        </div>

        {progress ? (
          <div className="order-2 animate-fade-up lg:order-3 lg:col-span-2" style={delay(260)}>
            <GoalHighlight progress={progress} snapshot={snapshot} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
