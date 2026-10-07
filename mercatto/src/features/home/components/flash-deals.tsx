import Link from "next/link";
import { ArrowRight, Clock, Zap } from "lucide-react";
import { Countdown } from "@/components/ui/countdown";
import { ProductRail } from "@/components/commerce/product-rail";
import type { FlashDeal } from "@/features/home/queries";

/** Estoque promocional real da oferta (limite cadastrado, sem passar do estoque dos produtos). */
function PromoStock({ stock }: { stock: NonNullable<FlashDeal["stock"]> }) {
  const used = stock.limit - stock.left;
  const pct = Math.round((used / stock.limit) * 100);
  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1 sm:max-w-64">
      <div className="h-1.5 overflow-hidden rounded-full bg-sun-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}% das unidades com desconto já foram reservadas`}>
        <div className="h-full origin-left rounded-full bg-sun-900 transition-transform duration-700" style={{ transform: `scaleX(${Math.max(0.04, used / stock.limit)})` }} />
      </div>
      <span className="text-xs font-semibold text-sun-900">{stock.left > 0 ? `Restam ${stock.left} ${stock.left === 1 ? "unidade" : "unidades"} com este desconto` : "Unidades com desconto esgotadas"}</span>
    </div>
  );
}

/**
 * Ofertas relâmpago ligadas às promoções reais cadastradas (isFlash). O
 * contador usa o término verdadeiro (o da primeira a acabar, e diz isso quando
 * há mais de um término); ao zerar a página é atualizada. Sem oferta ativa,
 * mostra quando começa a próxima campanha da plataforma (se houver).
 */
export function FlashDeals({ flash, favorites }: { flash: FlashDeal | null; favorites: string[] }) {
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
          <Clock className="size-4" aria-hidden /> Começa em <Countdown endsAt={flash.next.startsAt} label="Começa em" expiredText="Começando…" variant="inline" className="font-extrabold" />
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
          <span className="text-xs font-bold tracking-wide uppercase max-sm:sr-only">{flash.sameEnd ? "Termina em" : "A primeira termina em"}</span>
          <Countdown endsAt={flash.endsAt} variant="labeled" label={flash.sameEnd ? "Termina em" : "A primeira termina em"} />
        </div>
        {flash.stock ? <PromoStock stock={flash.stock} /> : null}
        <Link href="/ofertas" className="group inline-flex items-center gap-1 text-sm font-bold text-sun-900 underline-offset-4 hover:underline focus-ring max-sm:w-full">
          Ver todas <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      <div className="bg-gradient-to-b from-sun-50 to-surface p-3 sm:p-4">
        <ProductRail products={flash.products} label="Ofertas relâmpago" favorites={favorites} />
      </div>
    </section>
  );
}
