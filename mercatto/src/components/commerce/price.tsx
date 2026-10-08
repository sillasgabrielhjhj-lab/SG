import { bestInterestFreeInstallment, formatBRL, percentOf, splitBRL, type InstallmentConfig } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatSoldCount } from "@/lib/format";

const SIZE = {
  sm: { main: "text-xl", cents: "text-[0.5em] mt-[0.1em]", list: "text-xs", badge: "text-[10px]", sold: "text-[11px]" },
  md: { main: "text-2xl sm:text-[1.625rem]", cents: "text-[0.46em] mt-[0.12em]", list: "text-[13px]", badge: "text-[11px]", sold: "text-xs" },
  lg: { main: "text-[1.75rem]", cents: "text-[0.45em] mt-[0.14em]", list: "text-[13px]", badge: "text-xs", sold: "text-xs" },
  xl: { main: "text-[1.75rem] lg:text-[2rem]", cents: "text-[0.45em] mt-[0.15em]", list: "text-sm", badge: "text-xs", sold: "text-[13px]" },
} as const;

/** Percentual de desconto real (arredondado para baixo: nunca exagera o desconto). */
export function discountPercentOf(priceCents: number, listPriceCents: number | null | undefined): number {
  if (!listPriceCents || listPriceCents <= priceCents || priceCents <= 0) return 0;
  return Math.floor(((listPriceCents - priceCents) * 100) / listPriceCents);
}

/**
 * Preço padrão do marketplace (cards, busca, vitrines e página do produto):
 *  - linha de cima: preço anterior riscado + selo "X% OFF" (só com desconto real);
 *  - linha principal: preço com centavos menores e elevados;
 *  - ao lado: unidades vendidas reais ("57 vendidos", "+1 mil vendidos").
 */
export function Price({ priceCents, listPriceCents, soldCount, size = "md", className }: { priceCents: number; listPriceCents?: number | null; soldCount?: number; size?: keyof typeof SIZE; className?: string }) {
  const { integer, decimal } = splitBRL(priceCents);
  const pct = discountPercentOf(priceCents, listPriceCents);
  const sold = soldCount ? formatSoldCount(soldCount) : null;
  const s = SIZE[size];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {pct >= 1 && listPriceCents ? (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <s className={cn("leading-none text-fg-subtle tabular", s.list)}>
            <span className="sr-only">Preço anterior: </span>
            {formatBRL(listPriceCents)}
          </s>
          <span className={cn("rounded-[4px] bg-deal px-1.5 py-0.5 leading-none font-semibold text-white tabular", s.badge)}>
            {pct}% OFF<span className="sr-only"> de desconto</span>
          </span>
        </span>
      ) : null}
      <span className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
        <span className="sr-only">Preço: {formatBRL(priceCents)}</span>
        <span aria-hidden className={cn("inline-flex items-start leading-none font-medium tracking-tight whitespace-nowrap text-fg tabular", s.main)}>
          <span>R$&nbsp;{integer}</span>
          <span className={cn("ml-0.5 leading-none", s.cents)}>{decimal}</span>
        </span>
        {sold ? <span className={cn("pb-[0.1em] leading-none whitespace-nowrap text-fg-subtle", s.sold)}>{sold}</span> : null}
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
