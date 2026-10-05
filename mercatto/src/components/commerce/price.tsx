import { bestInterestFreeInstallment, formatBRL, percentOf, splitBRL, type InstallmentConfig } from "@/lib/money";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { main: "text-lg", cents: "text-[0.6rem] mt-[0.2em]", list: "text-xs" },
  md: { main: "text-2xl", cents: "text-xs mt-[0.25em]", list: "text-xs" },
  lg: { main: "text-[1.75rem]", cents: "text-sm mt-[0.3em]", list: "text-sm" },
  xl: { main: "text-4xl", cents: "text-base mt-[0.35em]", list: "text-sm" },
} as const;

/** Preço estilo marketplace: "de" riscado, preço com centavos sobrescritos e % OFF. */
export function Price({ priceCents, listPriceCents, discountPercent, size = "md", className, showDiscount = true }: { priceCents: number; listPriceCents?: number | null; discountPercent?: number; size?: keyof typeof SIZE; className?: string; showDiscount?: boolean }) {
  const { integer, decimal } = splitBRL(priceCents);
  const s = SIZE[size];
  return (
    <div className={cn("flex flex-col", className)}>
      {listPriceCents && listPriceCents > priceCents ? (
        <span className={cn("text-fg-subtle line-through tabular", s.list)}>
          <span className="sr-only">Preço anterior: </span>
          {formatBRL(listPriceCents)}
        </span>
      ) : null}
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("inline-flex items-start leading-none font-semibold tracking-tight text-fg tabular", s.main)} aria-label={formatBRL(priceCents)}>
          <span aria-hidden className="mr-0.5 self-start text-[0.55em] leading-[1.35] font-medium">R$</span>
          <span aria-hidden>{integer}</span>
          <span aria-hidden className={cn("leading-none", s.cents)}>{decimal}</span>
        </span>
        {showDiscount && discountPercent && discountPercent > 0 ? <span className={cn("font-semibold text-brand-700", size === "sm" ? "text-xs" : "text-sm")}>{discountPercent}% OFF</span> : null}
      </span>
    </div>
  );
}

export function InstallmentsText({ priceCents, config, className }: { priceCents: number; config?: InstallmentConfig; className?: string }) {
  const best = bestInterestFreeInstallment(priceCents, config);
  if (!best) return null;
  return (
    <p className={cn("text-xs text-fg-muted", className)}>
      em até{" "}
      <span className="font-semibold text-brand-700">
        {best.count}x de {formatBRL(best.installmentCents)} sem juros
      </span>
    </p>
  );
}

export function PixPrice({ priceCents, pixDiscountPercent, className }: { priceCents: number; pixDiscountPercent: number; className?: string }) {
  if (!pixDiscountPercent) return null;
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-bold text-fg">{formatBRL(priceCents - percentOf(priceCents, pixDiscountPercent))}</span> <span className="text-fg-muted">no PIX ({pixDiscountPercent}% OFF)</span>
    </p>
  );
}
