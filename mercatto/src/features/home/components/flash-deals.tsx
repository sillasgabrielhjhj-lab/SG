import Link from "next/link";
import { ArrowRight, Clock, Zap } from "lucide-react";
import { Countdown } from "@/components/ui/countdown";
import { ProductRail } from "@/components/commerce/product-rail";
import type { ProductCardData } from "@/features/catalog/types";

type FlashData = { endsAt: string | null; products: ProductCardData[]; next: { name: string; startsAt: string } | null } | null;

/**
 * Ofertas relâmpago ligadas à promoção real cadastrada (isFlash). O contador
 * usa o término verdadeiro; ao zerar a página é atualizada e a seção some.
 * Sem oferta ativa, mostra quando começa a próxima (se houver uma agendada).
 */
export function FlashDeals({ flash, favorites }: { flash: FlashData; favorites: string[] }) {
  if (!flash) return null;
  if (!flash.endsAt || !flash.products.length) {
    if (!flash.next) return null;
    return (
      <section data-reveal aria-label="Próxima oferta relâmpago" className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-sun-300 bg-sun-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-sun-900">
          <Zap className="size-5 text-sun-600" fill="currentColor" aria-hidden />
          Próxima oferta relâmpago: {flash.next.name}
        </p>
        <span className="flex items-center gap-2 text-sm font-semibold text-sun-900">
          <Clock className="size-4" aria-hidden /> Começa em <Countdown endsAt={flash.next.startsAt} label="Começa em" variant="inline" className="font-extrabold" />
        </span>
      </section>
    );
  }
  return (
    <section data-reveal aria-labelledby="flash-title" className="overflow-hidden rounded-panel border border-sun-300 bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-sun-400 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sun-900 text-sun-300 shadow-sm">
            <Zap className="size-5" fill="currentColor" aria-hidden />
          </span>
          <div>
            <h2 id="flash-title" className="text-lg leading-tight font-extrabold tracking-tight text-sun-900 uppercase sm:text-xl">
              Ofertas relâmpago
            </h2>
            <p className="text-xs font-semibold text-sun-900/80 sm:text-sm">Preços especiais por tempo limitado</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sun-900">
          <span className="text-xs font-bold tracking-wide uppercase max-sm:sr-only">Termina em</span>
          <Countdown endsAt={flash.endsAt} variant="labeled" />
        </div>
        <Link href="/ofertas" className="group inline-flex items-center gap-1 text-sm font-bold text-sun-900 underline-offset-4 hover:underline focus-ring max-sm:w-full">
          Ver todas <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      <div className="bg-gradient-to-b from-sun-50 to-surface p-3 sm:p-4">
        <ProductRail products={flash.products} label="Ofertas relâmpago" favorites={favorites} cardOptions={{ showPromoStock: true }} />
      </div>
    </section>
  );
}
