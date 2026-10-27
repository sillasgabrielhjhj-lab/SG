import { ArrowRight, HandHeart, Heart, Lock, QrCode, Smartphone } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign } from "@/config/campaign";
import { coverPhoto } from "@/content/photos";

const ASSURANCES = [
  { icon: QrCode, text: "Pix com QR Code ou Copia e Cola" },
  { icon: Smartphone, text: "Direto no app do seu banco" },
  { icon: Lock, text: "Não pedimos dados bancários" },
];

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div aria-hidden className="absolute -top-32 -left-24 -z-10 size-[28rem] rounded-full bg-brand-200/50 blur-3xl" />
      <div aria-hidden className="absolute top-48 -right-32 -z-10 size-[26rem] rounded-full bg-blush blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-9 px-4 pt-6 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-14 lg:pb-24">
        <div className="order-2 text-center lg:order-1 lg:text-left">
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
          <div className="mt-8 animate-fade-up" style={delay(340)}>
            <Link href="/doar" className={btn({ size: "lg", className: "shine w-full sm:w-auto" })}>
              QUERO AJUDAR O TOBIAS
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </div>
          <ul
            className="mt-8 flex animate-fade-up flex-col items-center gap-2.5 text-sm font-semibold text-brand-900 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:justify-start"
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

        <div className="relative order-1 mx-auto w-full max-w-md animate-fade-up lg:order-2 lg:max-w-none" style={delay(80)}>
          <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-[2rem] bg-brand-200/70 sm:translate-x-4 sm:translate-y-4" />
          <Link
            href="/doar"
            className="group relative block aspect-[4/3] overflow-hidden rounded-[2rem] bg-white shadow-lift ring-[6px] ring-white sm:aspect-[5/4] lg:aspect-[4/5]"
          >
            <PhotoFrame
              photo={coverPhoto}
              decorative
              sizes="(min-width: 1024px) 520px, (min-width: 640px) 448px, 90vw"
              priority
              className="transition duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 text-left shadow-soft backdrop-blur sm:inset-x-4 sm:bottom-4">
              <span>
                <span className="block text-sm font-extrabold text-brand-950">Ajude o Tobias</span>
                <span className="block text-xs text-muted">Toque aqui para doar por Pix</span>
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition group-hover:translate-x-1">
                <ArrowRight aria-hidden className="size-5" />
              </span>
            </span>
          </Link>
          <Heart aria-hidden className="absolute -top-5 -right-2 size-9 animate-float fill-heart text-heart [--r:12deg] sm:-right-5" />
          <Heart aria-hidden className="absolute bottom-24 -left-3 size-6 animate-float fill-brand-400 text-brand-400 [--r:-14deg] [animation-delay:1.5s] sm:-left-6 sm:size-7" />
        </div>
      </div>
    </section>
  );
}
