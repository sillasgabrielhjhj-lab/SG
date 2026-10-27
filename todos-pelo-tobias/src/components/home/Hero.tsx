import { ArrowRight, HandHeart, Heart, Lock, QrCode, Smartphone } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign } from "@/config/campaign";
import { coverPhoto, featuredVideo } from "@/content/photos";
import type { FundraisingSnapshot } from "@/lib/fundraising";
import { GoalCard } from "./GoalCard";
import { HeroVideoButton } from "./HeroVideoButton";

const ASSURANCES = [
  { icon: QrCode, text: "Pix com QR Code ou Copia e Cola" },
  { icon: Smartphone, text: "Direto no app do seu banco" },
  { icon: Lock, text: "Não pedimos dados bancários" },
];

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/**
 * No celular a ordem visual é: foto, card da meta, título e botão (a meta aparece já na primeira
 * tela). No desktop: texto à esquerda, foto à direita e o card da meta cruzando a base do banner.
 */
export function Hero({ goal }: { goal: FundraisingSnapshot | null }) {
  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white"
    >
      <div
        aria-hidden
        className="absolute -top-32 -left-24 -z-10 size-[28rem] rounded-full bg-brand-200/50 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute top-48 -right-32 -z-10 size-[26rem] rounded-full bg-blush blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl px-4 pt-6 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-16 lg:pt-10 lg:pb-24">
        <div className="order-3 mt-10 text-center lg:order-none lg:col-start-1 lg:row-start-1 lg:mt-0 lg:self-start lg:pb-24 lg:text-left">
          <p
            className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand-800 shadow-sm ring-1 ring-brand-200"
            style={delay(60)}
          >
            <HandHeart aria-hidden className="size-4 text-heart" />
            Campanha solidária
          </p>
          <h1
            className="mt-5 animate-fade-up text-[2.6rem] leading-[1.02] font-black text-brand-950 sm:text-6xl lg:text-[4.4rem]"
            style={delay(140)}
          >
            TODOS PELO <span className="text-brand-600">TOBIAS</span>{" "}
            <span aria-hidden className="inline-block animate-beat">
              ❤️
            </span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-lg leading-relaxed text-muted sm:text-xl lg:mx-0"
            style={delay(240)}
          >
            {campaign.tagline}
          </p>
          <p
            className="mx-auto mt-3 max-w-xl animate-fade-up text-[0.95rem] leading-relaxed text-ink/80 lg:mx-0"
            style={delay(290)}
          >
            O pequeno Tobias tem 9 meses e precisa de tratamento médico.{" "}
            <Link
              href="/#conheca-tobias"
              className="font-bold text-brand-700 underline underline-offset-4 hover:text-brand-900"
            >
              Conheça a história
            </Link>
          </p>
          <div className="mt-6 animate-fade-up" style={delay(340)}>
            <Link href="/doar" className={btn({ size: "lg", className: "shine w-full sm:w-auto" })}>
              QUERO AJUDAR O TOBIAS
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </div>
        </div>

        <div
          className="relative order-1 mx-auto w-full max-w-md animate-fade-up lg:order-none lg:col-start-2 lg:row-start-1 lg:max-w-none lg:self-center"
          style={delay(80)}
        >
          <div
            aria-hidden
            className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-[2rem] bg-brand-200/70 sm:translate-x-4 sm:translate-y-4"
          />
          <Link
            href="/doar"
            aria-label="Fazer uma doação para a campanha Todos pelo Tobias"
            className="group relative block aspect-[4/3] overflow-hidden rounded-[2rem] bg-white shadow-lift ring-[6px] ring-white"
          >
            <PhotoFrame
              photo={coverPhoto}
              decorative
              sizes="(min-width: 1024px) 520px, (min-width: 640px) 448px, 90vw"
              priority
              className="transition duration-700 group-hover:scale-105"
            />
          </Link>
          {featuredVideo ? <HeroVideoButton video={featuredVideo} /> : null}
          <Heart
            aria-hidden
            className="absolute -top-5 -right-2 size-9 animate-float fill-heart text-heart [--r:12deg] sm:-right-5"
          />
          <Heart
            aria-hidden
            className="absolute bottom-10 -left-3 size-6 animate-float fill-brand-400 text-brand-400 [--r:-14deg] [animation-delay:1.5s] sm:-left-6 sm:size-7"
          />
        </div>

        {goal ? (
          <div
            className="relative z-10 order-2 mx-auto -mt-8 w-full max-w-md animate-fade-up lg:order-none lg:col-span-2 lg:row-start-2 lg:-mt-16 lg:max-w-none"
            style={delay(220)}
          >
            <GoalCard snapshot={goal} />
          </div>
        ) : null}

        <ul
          className="order-4 mt-8 flex animate-fade-up flex-col items-center gap-2.5 text-sm font-semibold text-brand-900 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 lg:order-none lg:col-span-2 lg:row-start-3 lg:mt-10"
          style={delay(440)}
        >
          {ASSURANCES.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-2">
              <Icon aria-hidden className="size-4 text-brand-600" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
