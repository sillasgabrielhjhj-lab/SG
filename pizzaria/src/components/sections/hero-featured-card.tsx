'use client';

import { Plus } from 'lucide-react';
import { useProductActions } from '@/hooks/use-product-actions';
import { formatPrice } from '@/lib/format';
import { featuredProducts, getStartingPrice } from '@/lib/menu';

/** Cartão flutuante do hero com a pizza em destaque. */
export function HeroFeaturedCard() {
  const { open } = useProductActions();
  const product = featuredProducts[0];
  if (!product) return null;

  return (
    <button
      type="button"
      onClick={() => open(product)}
      className="group flex items-center gap-3 rounded-2xl bg-cream-50 py-2.5 pr-2.5 pl-4 text-left text-ink-900 shadow-2xl transition-transform hover:-translate-y-0.5"
      aria-label={`${product.name}, a partir de ${formatPrice(getStartingPrice(product))}. Ver opções`}
    >
      <span className="leading-tight">
        <span className="block text-[0.6875rem] font-bold tracking-[0.14em] text-tomato-600 uppercase">Mais pedida</span>
        <span className="text-display block text-lg font-medium">{product.name}</span>
        <span className="text-xs text-ink-500">a partir de {formatPrice(getStartingPrice(product))}</span>
      </span>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-tomato-500 text-white transition-transform group-hover:rotate-90">
        <Plus className="size-5" aria-hidden />
      </span>
    </button>
  );
}
