import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faixa promocional entre seções (quebra a sequência de grades). Usar com
 * parcimônia — no máximo duas ou três por página — e só com mensagem verdadeira.
 */
export function PromoStrip({ title, subtitle, cta, href, icon, tone = "brand", aside }: { title: string; subtitle?: string; cta: string; href: string; icon?: ReactNode; tone?: "brand" | "sun" | "light"; aside?: ReactNode }) {
  return (
    <Link
      data-reveal
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-panel px-5 py-5 focus-ring sm:flex-row sm:items-center sm:justify-between sm:px-7",
        tone === "brand" && "bg-brand-800 text-white",
        tone === "sun" && "bg-sun-300 text-sun-900",
        tone === "light" && "bg-brand-50 text-brand-950 ring-1 ring-brand-200 ring-inset",
      )}
    >
      <span aria-hidden className={cn("absolute -top-20 -right-10 size-56 rounded-full transition-transform duration-700 ease-out-soft group-hover:scale-110", tone === "brand" ? "bg-brand-700/60" : tone === "sun" ? "bg-sun-200" : "bg-brand-100")} />
      <span aria-hidden className={cn("absolute -bottom-24 left-1/3 size-48 rounded-full", tone === "brand" ? "bg-brand-900/50" : tone === "sun" ? "bg-sun-400/50" : "bg-white/60")} />
      <span className="relative flex items-center gap-3">
        {icon ? <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-6", tone === "brand" ? "bg-white/10 text-sun-300" : "bg-white/70 text-brand-700")}>{icon}</span> : null}
        <span>
          <span className="block text-lg leading-tight font-extrabold tracking-tight sm:text-xl">{title}</span>
          {subtitle ? <span className={cn("mt-0.5 block text-sm", tone === "brand" ? "text-white/80" : "opacity-80")}>{subtitle}</span> : null}
        </span>
      </span>
      <span className="relative flex items-center gap-3 self-start sm:self-auto">
        {aside}
        <span className={cn("press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-sm transition-colors", tone === "brand" ? "bg-sun-400 text-sun-900 group-hover:bg-sun-300" : "bg-brand-800 text-white group-hover:bg-brand-900")}>
          {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
