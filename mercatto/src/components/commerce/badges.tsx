import { BadgeCheck, FlaskConical, Truck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfficialBadge({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-brand-800 font-semibold text-white", compact ? "px-1.5 py-px text-2xs" : "px-2 py-0.5 text-xs", className)}>
      <BadgeCheck className={compact ? "size-3" : "size-3.5"} aria-hidden />
      Oficial Mercatto
    </span>
  );
}

export function SoldByMercatto({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-brand-800", className)}>
      <BadgeCheck className="size-3.5 text-brand-700" aria-hidden />
      Vendido e entregue pela Mercatto
    </span>
  );
}

export function DiscountBadge({ percent, className }: { percent: number; className?: string }) {
  if (percent <= 0) return null;
  return <span className={cn("inline-flex items-center rounded-md bg-brand-700 px-1.5 py-0.5 text-xs font-bold text-white tabular", className)}>-{percent}%</span>;
}

export function FreeShippingBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-success-700", className)}>
      <Truck className="size-3.5" aria-hidden />
      Frete grátis
    </span>
  );
}

export function FlashBadge({ className, label = "Oferta relâmpago" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-sun-400 px-2 py-0.5 text-2xs font-bold tracking-wide text-sun-900 uppercase", className)}>
      <Zap className="size-3" fill="currentColor" aria-hidden />
      {label}
    </span>
  );
}

export function StockIndicator({ stock, lowThreshold = 5, className }: { stock: number; lowThreshold?: number; className?: string }) {
  if (stock <= 0) return <span className={cn("text-xs font-semibold text-danger-700", className)}>Esgotado</span>;
  if (stock <= lowThreshold)
    return (
      <span className={cn("text-xs font-semibold text-coral-600", className)}>
        {stock === 1 ? "Última unidade!" : `Últimas ${stock} unidades`}
      </span>
    );
  return <span className={cn("text-xs font-medium text-success-700", className)}>Em estoque</span>;
}

/** Sinaliza dados de demonstração (seed de desenvolvimento). */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span title="Dado de demonstração (ambiente de desenvolvimento)" className={cn("inline-flex items-center gap-0.5 rounded bg-info-50 px-1 py-px text-[10px] font-bold tracking-wider text-info-700 uppercase ring-1 ring-info-600/20", className)}>
      <FlaskConical className="size-2.5" aria-hidden />
      Demo
    </span>
  );
}
