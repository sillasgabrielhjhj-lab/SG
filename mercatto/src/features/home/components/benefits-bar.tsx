import Link from "next/link";
import { CreditCard, Headset, QrCode, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import type { StoreBenefit } from "@/features/home/benefits.server";

export const BENEFIT_ICONS: Record<StoreBenefit["key"], LucideIcon> = {
  pix: QrCode,
  card: CreditCard,
  shipping: Truck,
  secure: ShieldCheck,
  returns: RotateCcw,
  support: Headset,
};

/** Faixa de benefícios (dados reais da configuração). Desktop: linha; mobile: carrossel com swipe. */
export function BenefitsBar({ items }: { items: StoreBenefit[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Benefícios de comprar na Mercatto" className="animate-enter [--enter-delay:140ms]">
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 py-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 lg:gap-3">
        {items.map((b) => {
          const Icon = BENEFIT_ICONS[b.key];
          return (
            <li key={b.key} className="w-[68%] shrink-0 snap-start min-[420px]:w-[46%] sm:w-auto">
              <Link href={b.href} className="group flex h-full items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 transition-[transform,translate,scale,box-shadow,border-color] duration-(--motion-base) ease-enter hover:border-brand-300 focus-ring active:scale-[0.99] [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-transform duration-(--motion-base) ease-enter group-hover:scale-[1.03]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-bold text-fg">{b.title}</span>
                  <span className="block truncate text-xs text-fg-muted">{b.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
