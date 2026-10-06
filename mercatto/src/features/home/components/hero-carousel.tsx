"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Gift, MapPin, Package, Pause, Play, Sparkles, Truck } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { skipImageOptimization } from "@/lib/images";
import { LogoMark } from "@/components/brand/logo";
import type { HeroSlide, HeroSlideArt } from "@/features/home/hero.server";

const AUTOPLAY_MS = 6500;
const HOLD_AFTER_TOUCH_MS = 6000;

const THEMES: Record<HeroSlide["theme"], { bg: string; text: string; sub: string; eyebrow: string; cta: string; notch: string }> = {
  brand: { bg: "bg-brand-800", text: "text-white", sub: "text-white/85", eyebrow: "text-sun-300", cta: "bg-sun-400 text-sun-900 hover:bg-sun-300", notch: "bg-brand-800" },
  sun: { bg: "bg-sun-200", text: "text-sun-900", sub: "text-sun-900/80", eyebrow: "text-sun-800", cta: "bg-brand-800 text-white hover:bg-brand-900", notch: "bg-sun-200" },
  ink: { bg: "bg-[oklch(0.24_0.03_210)]", text: "text-white", sub: "text-white/80", eyebrow: "text-brand-300", cta: "bg-white text-brand-900 hover:bg-brand-50", notch: "bg-[oklch(0.24_0.03_210)]" },
  coral: { bg: "bg-coral-600", text: "text-white", sub: "text-white/85", eyebrow: "text-white", cta: "bg-white text-coral-700 hover:bg-coral-50", notch: "bg-coral-600" },
  light: { bg: "bg-brand-50", text: "text-brand-950", sub: "text-fg-muted", eyebrow: "text-brand-700", cta: "bg-brand-800 text-white hover:bg-brand-900", notch: "bg-brand-50" },
};

/** Arte do slide — composições leves (HTML/SVG), fotos reais dos produtos ou o banner enviado no painel. */
function SlideArt({ art, theme, eager }: { art: HeroSlideArt; theme: (typeof THEMES)[HeroSlide["theme"]]; eager: boolean }) {
  if (art.kind === "coupon") {
    return (
      <div className="relative size-full">
        <div className="absolute top-1/2 left-1/2 w-[86%] max-w-[17.5rem] -translate-x-1/2 -translate-y-1/2 -rotate-6">
          <div className="relative rounded-[1.25rem] bg-white px-4 py-4 text-center shadow-[0_24px_50px_-18px_oklch(0.15_0.04_200/0.6)] sm:px-6 sm:py-6">
            <span aria-hidden className={cn("absolute top-[58%] -left-3 size-6 rounded-full", theme.notch)} />
            <span aria-hidden className={cn("absolute top-[58%] -right-3 size-6 rounded-full", theme.notch)} />
            <p className="text-[10px] font-bold tracking-[0.2em] text-brand-700 uppercase sm:text-xs">Cupom</p>
            <p className="mt-1 text-[1.65rem] leading-none font-extrabold tracking-tight text-brand-900 sm:text-5xl">{art.headline}</p>
            <p className="mt-3 border-t-2 border-dashed border-sun-300 pt-2 font-mono text-xs font-extrabold tracking-[0.18em] text-fg sm:text-base">{art.code}</p>
          </div>
        </div>
        <span aria-hidden className="absolute top-[12%] right-[10%] grid size-9 place-items-center rounded-full bg-sun-400 text-sun-900 shadow-raised sm:size-12">
          <Gift className="size-4 sm:size-6" />
        </span>
        <Sparkles aria-hidden className="absolute bottom-[16%] left-[12%] size-4 text-sun-300 sm:size-6" />
      </div>
    );
  }
  if (art.kind === "products") {
    const [main, second, third] = art.images;
    const tile = "absolute overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_-16px_oklch(0.1_0.03_200/0.55)]";
    return (
      <div className="relative size-full">
        {second ? (
          <div className={cn(tile, "top-[10%] left-[4%] size-[38%] -rotate-6")}>
            <Image src={second.url} alt="" fill sizes="(max-width: 640px) 25vw, 180px" unoptimized={skipImageOptimization(second.url)} className="object-contain p-2" />
          </div>
        ) : null}
        {third ? (
          <div className={cn(tile, "bottom-[8%] left-[14%] size-[32%] rotate-3")}>
            <Image src={third.url} alt="" fill sizes="(max-width: 640px) 20vw, 150px" unoptimized={skipImageOptimization(third.url)} className="object-contain p-2" />
          </div>
        ) : null}
        {main ? (
          <div className={cn(tile, "top-1/2 right-[6%] aspect-square h-[70%] -translate-y-1/2")}>
            <Image src={main.url} alt={main.alt} fill priority={eager} sizes="(max-width: 640px) 40vw, 300px" unoptimized={skipImageOptimization(main.url)} className="object-contain p-3" />
          </div>
        ) : null}
      </div>
    );
  }
  if (art.kind === "shipping") {
    return (
      <div className="relative size-full text-brand-700">
        <svg aria-hidden viewBox="0 0 200 120" className="absolute inset-x-[6%] top-[22%] h-[56%] w-[88%]" fill="none">
          <path d="M8 100 C 60 100, 70 20, 120 30 S 180 60, 192 18" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round" />
        </svg>
        <span className="absolute top-1/2 left-1/2 grid size-[42%] max-h-40 max-w-40 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_24px_50px_-20px_oklch(0.3_0.06_175/0.5)]">
          <Truck className="size-1/2" aria-hidden />
        </span>
        <span aria-hidden className="absolute top-[14%] left-[10%] grid size-10 rotate-[-8deg] place-items-center rounded-xl bg-sun-300 text-sun-900 shadow-raised sm:size-12">
          <Package className="size-5 sm:size-6" />
        </span>
        <span aria-hidden className="absolute right-[8%] bottom-[14%] grid size-10 place-items-center rounded-full bg-brand-700 text-white shadow-raised sm:size-12">
          <MapPin className="size-5 sm:size-6" />
        </span>
      </div>
    );
  }
  if (art.kind === "brand") {
    return (
      <div className="relative grid size-full place-items-center">
        <span aria-hidden className="absolute size-[70%] rounded-full bg-white/10" />
        <LogoMark inverse className="relative size-24 drop-shadow-xl sm:size-36" />
      </div>
    );
  }
  return null;
}

/**
 * Carrossel principal. Autoplay moderado com barra de progresso, pausa ao
 * passar o mouse/focar/tocar (e botão de pausa), swipe no mobile, setas e
 * teclado (← →), profundidade sutil na arte e prefers-reduced-motion.
 * O primeiro slide não anima a opacidade (preserva o LCP).
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [manual, setManual] = useState(false);
  const [hold, setHold] = useState(false);
  const [changed, setChanged] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const reduced = usePrefersReducedMotion();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const count = slides.length;
  const paused = hover || focus || manual || hold || reduced;

  const go = useCallback(
    (i: number) => {
      setChanged(true);
      setIndex((i + count) % count);
      setCycle((c) => c + 1);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setTimeout(() => {
      setChanged(true);
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, count, cycle]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  if (!count) return null;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques e campanhas"
      className="group/hero relative animate-enter-scale touch-pan-y overflow-hidden rounded-banner shadow-card [--enter-delay:60ms]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        else if (e.key === "ArrowLeft") go(index - 1);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
        window.clearTimeout(holdTimer.current);
        setHold(true);
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const end = e.changedTouches[0];
        if (start && end) {
          const dx = end.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(end.clientY - start.y)) go(index + (dx < 0 ? 1 : -1));
        }
        touch.current = null;
        holdTimer.current = window.setTimeout(() => setHold(false), HOLD_AFTER_TOUCH_MS);
      }}
    >
      <div className="flex transition-transform duration-[650ms] ease-out-soft" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => {
          const t = THEMES[s.theme];
          const active = i === index;
          const enter = changed && active;
          const bannerImage = s.art.kind === "image" && s.imageUrl && !failed[s.id] ? s.imageUrl : null;
          return (
            <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${count}: ${s.title}`} aria-hidden={!active} inert={!active} className={cn("relative w-full shrink-0 overflow-hidden", t.bg)}>
              <div className="relative h-[15.5rem] sm:h-[18.75rem] lg:h-[22.5rem]">
                {bannerImage ? (
                  <>
                    <Image src={bannerImage} alt="" fill priority={i === 0} onError={() => setFailed((f) => ({ ...f, [s.id]: true }))} sizes="(max-width: 1280px) 100vw, 1280px" unoptimized={skipImageOptimization(bannerImage)} className="object-cover object-[75%_center] sm:object-right" />
                    {/* Legibilidade no celular: a arte do banner fica sob o texto. */}
                    <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[80%] bg-gradient-to-r to-transparent sm:hidden", s.theme === "sun" || s.theme === "light" ? "from-white/80 via-white/50" : "from-black/55 via-black/30")} />
                  </>
                ) : (
                  <>
                    <span aria-hidden className="absolute -top-24 -right-20 size-80 rounded-full bg-white/[0.06] sm:size-[28rem]" />
                    <span aria-hidden className="absolute -bottom-32 left-[38%] size-72 rounded-full bg-black/[0.05]" />
                    <div
                      aria-hidden={s.art.kind !== "products"}
                      className="absolute inset-y-0 right-0 w-[44%] transition-transform duration-[900ms] ease-out-soft sm:w-[48%] lg:right-[3%] lg:w-[44%]"
                      style={{ transform: active ? "translateX(0)" : `translateX(${i < index ? -28 : 28}px)` }}
                    >
                      <SlideArt art={s.art} theme={t} eager={i === 0} />
                    </div>
                  </>
                )}
                <div className="relative z-[1] flex h-full max-w-[58%] flex-col justify-center gap-1.5 pr-2 pl-5 sm:max-w-[52%] sm:gap-3 sm:pl-10 lg:pl-14">
                  {s.eyebrow ? (
                    <span className={cn("text-[11px] font-bold tracking-wider uppercase sm:text-sm", t.eyebrow, enter && "animate-fade-up")} style={enter ? ({ animationDelay: "40ms" } as CSSProperties) : undefined}>
                      {s.eyebrow}
                    </span>
                  ) : null}
                  <h2 className={cn("text-[1.35rem] leading-[1.15] font-extrabold tracking-tight text-balance sm:text-3xl lg:text-[2.6rem]", t.text, enter && "animate-fade-up")} style={enter ? ({ animationDelay: "90ms" } as CSSProperties) : undefined}>
                    {s.title}
                  </h2>
                  {s.subtitle ? (
                    <p className={cn("line-clamp-3 text-[13px] leading-snug sm:line-clamp-2 sm:text-base", t.sub, enter && "animate-fade-up")} style={enter ? ({ animationDelay: "140ms" } as CSSProperties) : undefined}>
                      {s.subtitle}
                    </p>
                  ) : null}
                  <Link
                    href={s.link}
                    onClick={() => trackEvent("select_promotion", { promotion_id: s.id, promotion_name: s.title, creative_slot: String(i + 1) })}
                    className={cn("press mt-1 inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-4 text-xs font-extrabold tracking-wide uppercase shadow-sm transition-colors focus-ring sm:h-11 sm:px-5 sm:text-sm", t.cta, enter && "animate-fade-up")}
                    style={enter ? ({ animationDelay: "190ms" } as CSSProperties) : undefined}
                  >
                    {s.ctaLabel}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Destaque anterior" className="press absolute top-1/2 left-3 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-fg opacity-0 shadow-raised transition-opacity group-hover/hero:opacity-100 focus:opacity-100 focus-ring md:grid">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Próximo destaque" className="press absolute top-1/2 right-3 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-fg opacity-0 shadow-raised transition-opacity group-hover/hero:opacity-100 focus:opacity-100 focus-ring md:grid">
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Ir para o destaque ${i + 1}: ${s.title}`} aria-current={i === index} className="grid h-4 place-items-center focus-ring">
                <span className={cn("block h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-300", i === index ? "w-7 bg-white/40" : "w-1.5 bg-white/60 hover:bg-white/90")}>
                  {i === index ? <span key={`${index}-${cycle}-${paused}`} className="block h-full origin-left animate-progress rounded-full bg-white" style={{ "--progress-duration": `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" } as CSSProperties} /> : null}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setManual((p) => !p)} aria-label={manual ? "Retomar rotação" : "Pausar rotação"} aria-pressed={manual} className="ml-0.5 grid size-5 place-items-center text-white focus-ring">
              {manual ? <Play className="size-3" fill="currentColor" /> : <Pause className="size-3" fill="currentColor" />}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
