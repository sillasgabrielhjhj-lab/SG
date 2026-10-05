"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

export type HeroSlide = { id: string; title: string; subtitle: string | null; eyebrow: string | null; ctaLabel: string | null; link: string; imageUrl: string | null; theme: string };

const THEMES: Record<string, { bg: string; text: string; sub: string; cta: string }> = {
  brand: { bg: "bg-brand-800", text: "text-white", sub: "text-white/85", cta: "bg-sun-400 text-sun-900 hover:bg-sun-300" },
  sun: { bg: "bg-sun-200", text: "text-sun-900", sub: "text-sun-900/80", cta: "bg-brand-800 text-white hover:bg-brand-900" },
  ink: { bg: "bg-[oklch(0.24_0.03_210)]", text: "text-white", sub: "text-white/80", cta: "bg-white text-brand-900 hover:bg-brand-50" },
  coral: { bg: "bg-coral-600", text: "text-white", sub: "text-white/85", cta: "bg-white text-coral-700 hover:bg-coral-50" },
  light: { bg: "bg-brand-50", text: "text-brand-950", sub: "text-fg-muted", cta: "bg-brand-700 text-white hover:bg-brand-800" },
};

/** Carrossel principal: autoplay com pausa (hover/foco/botão), setas, indicadores, swipe e prefers-reduced-motion. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const touch = useRef<number | null>(null);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex((i + count) % count), [count]);

  useEffect(() => {
    if (paused || reduced || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => window.clearInterval(t);
  }, [paused, reduced, count]);

  if (!count) return null;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="group relative overflow-hidden rounded-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touch.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(index + (end < start ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="flex transition-transform duration-500 ease-out-soft" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => {
          const t = THEMES[s.theme] ?? THEMES.brand!;
          return (
            <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${count}`} aria-hidden={i !== index} className={cn("relative w-full shrink-0", t.bg)}>
              <div className="relative h-[220px] sm:h-[280px] lg:h-[340px]">
                {s.imageUrl && !failed[s.id] ? (
                  <Image src={s.imageUrl} alt="" fill priority={i === 0} onError={() => setFailed((f) => ({ ...f, [s.id]: true }))} sizes="(max-width: 1280px) 100vw, 1280px" unoptimized={s.imageUrl.endsWith(".svg") || s.imageUrl.startsWith("/demo-assets/")} className="object-cover object-[75%_center] sm:object-right" />
                ) : null}
                <div className="relative z-[1] flex h-full max-w-[62%] flex-col justify-center gap-2 px-5 sm:max-w-[52%] sm:gap-3 sm:px-10 lg:px-14">
                  {s.eyebrow ? <span className={cn("text-xs font-bold tracking-wider uppercase sm:text-sm", t.sub)}>{s.eyebrow}</span> : null}
                  <h2 className={cn("text-xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl lg:text-4xl", t.text)}>{s.title}</h2>
                  {s.subtitle ? <p className={cn("line-clamp-2 text-sm sm:text-base", t.sub)}>{s.subtitle}</p> : null}
                  <Link href={s.link} tabIndex={i === index ? 0 : -1} className={cn("mt-1 inline-flex h-10 w-fit items-center rounded-field px-4 text-sm font-bold shadow-sm transition-colors focus-ring sm:h-11 sm:px-5", t.cta)}>
                    {s.ctaLabel ?? "Confira"}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Destaque anterior" className="absolute top-1/2 left-3 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-fg shadow-raised opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-ring md:grid">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Próximo destaque" className="absolute top-1/2 right-3 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-fg shadow-raised opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-ring md:grid">
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/25 px-2 py-1.5 backdrop-blur-sm">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Ir para o destaque ${i + 1}`} aria-current={i === index} className={cn("h-2 rounded-full transition-all focus-ring", i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/90")} />
            ))}
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Retomar rotação" : "Pausar rotação"} className="ml-1 grid size-5 place-items-center text-white focus-ring">
              {paused ? <Play className="size-3" fill="currentColor" /> : <Pause className="size-3" fill="currentColor" />}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
