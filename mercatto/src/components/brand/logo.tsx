import { cn } from "@/lib/utils";

/**
 * Identidade Mercatto: símbolo (monograma "m" cujo traço final segue como uma
 * rota/seta — entrega e velocidade) + wordmark em minúsculas com o "tt"
 * destacado em Sol e unido por um traço contínuo.
 */
export function LogoMark({ className, inverse }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden focusable="false">
      <rect width="40" height="40" rx="11" fill={inverse ? "#ffffff" : "var(--color-brand-700, #0b5c4d)"} />
      <path d="M10 29V18.5a4.5 4.5 0 0 1 9 0V29M19 18.5a4.5 4.5 0 0 1 9 0V25" fill="none" stroke={inverse ? "var(--color-brand-800, #0a4f43)" : "#fff"} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24.6 22.6 28 26.2l3.6-3.6" fill="none" stroke="var(--color-sun-400, #f5b400)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ variant = "full", tone = "default", className, size = "md" }: { variant?: "full" | "mark"; tone?: "default" | "inverse"; className?: string; size?: "sm" | "md" | "lg" }) {
  const inverse = tone === "inverse";
  if (variant === "mark") return <LogoMark inverse={inverse} className={cn(size === "lg" && "size-10", size === "sm" && "size-7", className)} />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark inverse={inverse} className={cn(size === "sm" && "size-7", size === "lg" && "size-10")} />
      <span
        className={cn(
          "font-display leading-none font-extrabold tracking-[-0.045em]",
          size === "sm" && "text-xl",
          size === "md" && "text-[1.55rem]",
          size === "lg" && "text-3xl",
          inverse ? "text-white" : "text-brand-900",
        )}
      >
        merca
        <span className={cn("relative", inverse ? "text-sun-300" : "text-brand-600")}>
          tt
          <span aria-hidden className="absolute top-[0.36em] right-[0.06em] left-[0.04em] h-[0.1em] rounded-full bg-current" />
        </span>
        o<span className="sr-only">Mercatto</span>
      </span>
    </span>
  );
}
