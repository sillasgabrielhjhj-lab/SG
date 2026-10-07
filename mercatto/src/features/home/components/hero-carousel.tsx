"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { skipImageOptimization } from "@/lib/images";
import { SlideArt, THEMES } from "@/features/home/components/hero-slide-art";
import type { HeroSlide } from "@/features/home/hero.server";

const AUTOPLAY_MS = 6000;
/** Depois de um toque, o autoplay espera este tempo antes de seguir. */
const HOLD_AFTER_TOUCH_MS = 6000;
/** Arraste mínimo (px) para trocar de slide. */
const SWIPE_MIN_PX = 40;
/** Quanto o slide acompanha o dedo durante o arraste (resistência). */
const DRAG_FOLLOW = 0.35;
/** Deslocamento da troca de slides (fade + 8px). */
const SLIDE_SHIFT_PX = 8;
const IMAGE_SIZES = "(max-width: 1280px) 100vw, 1280px";

type Drag = { x: number; y: number; dx: number; axis: "x" | "y" | null };

/**
 * Carrossel principal: troca com fade + deslocamento mínimo, autoplay de 6s
 * com barra de progresso, pausa ao passar o mouse/focar/tocar (e botão de
 * pausa), arraste no celular (o slide acompanha o dedo; rolagem vertical
 * livre), setas, teclado (← →) e prefers-reduced-motion (sem autoplay).
 * O primeiro slide não anima ao trocar de página e é o único carregado com
 * prioridade (LCP); os demais só baixam depois dele.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [cycle, setCycle] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [manual, setManual] = useState(false);
  const [hold, setHold] = useState(false);
  const [warm, setWarm] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const reduced = usePrefersReducedMotion();
  const remaining = useRef(AUTOPLAY_MS);
  const drag = useRef<Drag | null>(null);
  const swiped = useRef(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const slideEls = useRef<(HTMLDivElement | null)[]>([]);
  const count = slides.length;
  const paused = hover || focus || manual || hold || reduced;
  const artwork = count > 0 && slides.every((s) => s.art.kind === "artwork");

  const show = useCallback(
    (next: number, direction: 1 | -1) => {
      if (next === index) return;
      setPrev(index);
      setDir(direction);
      setIndex(next);
      setCycle((c) => c + 1);
    },
    [index],
  );
  const step = (delta: 1 | -1) => show((index + delta + count) % count, delta);

  // Novo slide → tempo cheio; pausa → guarda o que falta e a barra congela junto.
  useEffect(() => {
    remaining.current = AUTOPLAY_MS;
  }, [index, cycle]);
  useEffect(() => {
    if (paused || count < 2) return;
    const started = performance.now();
    const t = window.setTimeout(() => {
      setPrev(index);
      setDir(1);
      setIndex((index + 1) % count);
    }, remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [index, cycle, paused, count]);

  // Os slides seguintes só baixam depois do primeiro (ou após 2,5s, no pior caso).
  useEffect(() => {
    const t = window.setTimeout(() => setWarm(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const activeEl = () => slideEls.current[index] ?? null;
  const resetDrag = () => {
    const el = activeEl();
    if (el) {
      el.style.transform = "";
      el.style.transition = "";
    }
  };

  if (!count) return null;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques e campanhas"
      className={cn("group/hero relative animate-hero-in [--enter-delay:40ms]", artwork && "max-sm:-mx-2")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
      }}
      onClickCapture={(e) => {
        // Um arraste não vira clique no banner.
        if (swiped.current) {
          e.preventDefault();
          e.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      <div
        className={cn("relative grid touch-pan-y overflow-hidden shadow-card", artwork ? "rounded-xl bg-brand-900 sm:rounded-banner" : "rounded-banner")}
        onTouchStart={(e) => {
          const t = e.touches[0];
          drag.current = t ? { x: t.clientX, y: t.clientY, dx: 0, axis: null } : null;
          swiped.current = false;
          window.clearTimeout(holdTimer.current);
          setHold(true);
        }}
        onTouchMove={(e) => {
          const d = drag.current;
          const t = e.touches[0];
          if (!d || !t || count < 2) return;
          d.dx = t.clientX - d.x;
          const dy = t.clientY - d.y;
          if (!d.axis && (Math.abs(d.dx) > 8 || Math.abs(dy) > 8)) d.axis = Math.abs(d.dx) > Math.abs(dy) ? "x" : "y";
          const el = activeEl();
          if (d.axis === "x" && el && !reduced) {
            el.style.transition = "none";
            el.style.transform = `translateX(${d.dx * DRAG_FOLLOW}px)`;
          }
        }}
        onTouchEnd={() => {
          const d = drag.current;
          drag.current = null;
          resetDrag();
          if (d?.axis === "x") {
            swiped.current = true;
            if (Math.abs(d.dx) > SWIPE_MIN_PX) step(d.dx < 0 ? 1 : -1);
          }
          holdTimer.current = window.setTimeout(() => setHold(false), HOLD_AFTER_TOUCH_MS);
        }}
        onTouchCancel={() => {
          drag.current = null;
          resetDrag();
          holdTimer.current = window.setTimeout(() => setHold(false), HOLD_AFTER_TOUCH_MS);
        }}
      >
        {slides.map((s, i) => {
          const active = i === index;
          const leaving = i === prev && !active;
          const motion = active && prev !== null ? "animate-slide-in" : leaving ? "animate-slide-out" : "";
          return (
            <div
              key={s.id}
              ref={(el) => {
                slideEls.current[i] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${count}: ${s.title}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "relative col-start-1 row-start-1 transition-transform duration-(--motion-base) ease-enter",
                active ? "z-[1] opacity-100" : "pointer-events-none opacity-0",
                motion,
              )}
              style={{ "--slide-from": `${SLIDE_SHIFT_PX * dir}px`, "--slide-to": `${-SLIDE_SHIFT_PX * dir}px` } as CSSProperties}
            >
              {s.art.kind === "artwork" ? (
                <Link
                  href={s.link}
                  draggable={false}
                  onClick={() => trackEvent("select_promotion", { promotion_id: s.id, promotion_name: s.title, creative_slot: String(i + 1) })}
                  className="relative block aspect-[2000/667] cursor-pointer outline-none transition-[scale,filter] duration-[120ms] ease-standard select-none active:scale-[0.998] active:brightness-[0.98] focus-visible:ring-4 focus-visible:ring-sun-300 focus-visible:ring-inset"
                >
                  {i === 0 || warm || active ? (
                    <Image
                      src={s.art.src}
                      alt={s.art.alt}
                      fill
                      sizes={IMAGE_SIZES}
                      quality={85}
                      draggable={false}
                      loading={i === 0 ? "eager" : undefined}
                      fetchPriority={i === 0 ? "high" : "low"}
                      onLoad={i === 0 ? () => setWarm(true) : undefined}
                      className="object-contain"
                    />
                  ) : null}
                </Link>
              ) : (
                <TextSlide slide={s} position={i} animate={active && prev !== null} loadImage={i === 0 || warm || active} failed={Boolean(failed[s.id])} onImageError={() => setFailed((f) => ({ ...f, [s.id]: true }))} />
              )}
            </div>
          );
        })}

        {count > 1 ? (
          <>
            <ArrowButton side="left" onClick={() => step(-1)} />
            <ArrowButton side="right" onClick={() => step(1)} />
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-1.5 flex items-center justify-center sm:absolute sm:bottom-3 sm:left-1/2 sm:z-[2] sm:mt-0 sm:-translate-x-1/2 sm:rounded-full sm:bg-black/30 sm:px-1.5 sm:backdrop-blur-[2px]">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => show(i, i > index ? 1 : -1)}
                aria-label={`Ir para o banner ${i + 1}`}
                aria-current={active}
                className="group/dot grid h-10 w-9 place-items-center rounded-full focus-ring sm:h-7 sm:w-8"
              >
                <span className={cn("relative block h-1 w-6 overflow-hidden rounded-full bg-fg/15 transition-colors duration-(--motion-fast) group-hover/dot:bg-fg/30 sm:bg-white/40 sm:group-hover/dot:bg-white/70", active && "bg-fg/20 sm:bg-white/50")}>
                  {active ? (
                    <span
                      key={`${index}-${cycle}`}
                      className="absolute inset-0 origin-left animate-progress rounded-full bg-brand-700 sm:bg-white"
                      style={{ "--progress-duration": `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" } as CSSProperties}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setManual((p) => !p)}
            aria-label={manual ? "Retomar a troca automática dos banners" : "Pausar a troca automática dos banners"}
            aria-pressed={manual}
            className="grid size-10 place-items-center rounded-full text-fg-muted focus-ring hover:text-fg sm:size-7 sm:text-white sm:hover:text-white"
          >
            {manual ? <Play className="size-3" fill="currentColor" aria-hidden /> : <Pause className="size-3" fill="currentColor" aria-hidden />}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Banner anterior" : "Próximo banner"}
      className={cn(
        "absolute top-1/2 z-[2] hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-fg shadow-[0_2px_10px_-3px_oklch(0.2_0.03_200/0.35)] transition-[scale,background-color,box-shadow] duration-(--motion-fast) ease-standard hover:scale-[1.04] hover:bg-white hover:shadow-raised focus-ring active:scale-[0.97] lg:grid xl:size-10",
        side === "left" ? "left-2.5 xl:left-4" : "right-2.5 xl:right-4",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

/** Slide com texto (banners do painel e campanhas automáticas) — usado quando não há arte oficial no ar. */
function TextSlide({ slide: s, position, animate, loadImage, failed, onImageError }: { slide: HeroSlide; position: number; animate: boolean; loadImage: boolean; failed: boolean; onImageError: () => void }) {
  const t = THEMES[s.theme];
  const bannerImage = s.art.kind === "image" && s.imageUrl && !failed ? s.imageUrl : null;
  const fade = (delay: number) => (animate ? { className: "animate-fade-up", style: { animationDelay: `${delay}ms` } as CSSProperties } : { className: "", style: undefined });
  return (
    <div className={cn("relative h-[15.5rem] overflow-hidden sm:h-[18.75rem] lg:h-[22.5rem]", t.bg)}>
      {bannerImage ? (
        <>
          {loadImage ? (
            <Image src={bannerImage} alt="" fill loading={position === 0 ? "eager" : undefined} fetchPriority={position === 0 ? "high" : "low"} onError={onImageError} sizes={IMAGE_SIZES} unoptimized={skipImageOptimization(bannerImage)} className="object-cover object-[75%_center] sm:object-right" />
          ) : null}
          {/* Legibilidade no celular: a arte do banner fica sob o texto. */}
          <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[80%] bg-gradient-to-r to-transparent sm:hidden", s.theme === "sun" || s.theme === "light" ? "from-white/80 via-white/50" : "from-black/55 via-black/30")} />
        </>
      ) : (
        <>
          <span aria-hidden className="absolute -top-24 -right-20 size-80 rounded-full bg-white/[0.06] sm:size-[28rem]" />
          <span aria-hidden className="absolute -bottom-32 left-[38%] size-72 rounded-full bg-black/[0.05]" />
          <div aria-hidden={s.art.kind !== "products"} className="absolute inset-y-0 right-0 w-[44%] sm:w-[48%] lg:right-[3%] lg:w-[44%]">
            <SlideArt art={s.art} theme={t} eager={position === 0} />
          </div>
        </>
      )}
      <div className="relative z-[1] flex h-full max-w-[58%] flex-col justify-center gap-1.5 pr-2 pl-5 sm:max-w-[52%] sm:gap-3 sm:pl-10 lg:pl-14">
        {s.eyebrow ? (
          <span className={cn("text-[11px] font-bold tracking-wider uppercase sm:text-sm", t.eyebrow, fade(40).className)} style={fade(40).style}>
            {s.eyebrow}
          </span>
        ) : null}
        <h2 className={cn("text-[1.35rem] leading-[1.15] font-extrabold tracking-tight text-balance sm:text-3xl lg:text-[2.6rem]", t.text, fade(90).className)} style={fade(90).style}>
          {s.title}
        </h2>
        {s.subtitle ? (
          <p className={cn("line-clamp-3 text-[13px] leading-snug sm:line-clamp-2 sm:text-base", t.sub, fade(140).className)} style={fade(140).style}>
            {s.subtitle}
          </p>
        ) : null}
        <Link
          href={s.link}
          onClick={() => trackEvent("select_promotion", { promotion_id: s.id, promotion_name: s.title, creative_slot: String(position + 1) })}
          className={cn("press mt-1 inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-4 text-xs font-extrabold tracking-wide uppercase shadow-sm transition-colors focus-ring sm:h-11 sm:px-5 sm:text-sm", t.cta, fade(190).className)}
          style={fade(190).style}
        >
          {s.ctaLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
