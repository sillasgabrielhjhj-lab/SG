import Image from "next/image";
import { Gift, MapPin, Package, Sparkles, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { skipImageOptimization } from "@/lib/images";
import { LogoMark } from "@/components/brand/logo";
import type { HeroSlide, HeroSlideArt } from "@/features/home/hero.server";

export const THEMES: Record<HeroSlide["theme"], { bg: string; text: string; sub: string; eyebrow: string; cta: string; notch: string }> = {
  brand: { bg: "bg-brand-800", text: "text-white", sub: "text-white/85", eyebrow: "text-sun-300", cta: "bg-sun-400 text-sun-900 hover:bg-sun-300", notch: "bg-brand-800" },
  sun: { bg: "bg-sun-200", text: "text-sun-900", sub: "text-sun-900/80", eyebrow: "text-sun-800", cta: "bg-brand-800 text-white hover:bg-brand-900", notch: "bg-sun-200" },
  ink: { bg: "bg-[oklch(0.24_0.03_210)]", text: "text-white", sub: "text-white/80", eyebrow: "text-brand-300", cta: "bg-white text-brand-900 hover:bg-brand-50", notch: "bg-[oklch(0.24_0.03_210)]" },
  coral: { bg: "bg-coral-600", text: "text-white", sub: "text-white/85", eyebrow: "text-white", cta: "bg-white text-coral-700 hover:bg-coral-50", notch: "bg-coral-600" },
  light: { bg: "bg-brand-50", text: "text-brand-950", sub: "text-fg-muted", eyebrow: "text-brand-700", cta: "bg-brand-800 text-white hover:bg-brand-900", notch: "bg-brand-50" },
};

/** Arte do slide — composições leves (HTML/SVG), fotos reais dos produtos ou o banner enviado no painel. */
export function SlideArt({ art, theme, eager }: { art: HeroSlideArt; theme: (typeof THEMES)[HeroSlide["theme"]]; eager: boolean }) {
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
            <Image src={main.url} alt={main.alt} fill loading={eager ? "eager" : undefined} fetchPriority={eager ? "high" : undefined} sizes="(max-width: 640px) 40vw, 300px" unoptimized={skipImageOptimization(main.url)} className="object-contain p-3" />
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
