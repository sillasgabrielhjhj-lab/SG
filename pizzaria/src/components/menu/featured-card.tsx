'use client';

import { Plus } from 'lucide-react';
import { SmartImage } from '@/components/ui/smart-image';
import { useProductActions } from '@/hooks/use-product-actions';
import { formatPrice } from '@/lib/format';
import { getStartingPrice, hasMultiplePrices } from '@/lib/menu';
import type { Product } from '@/types/menu';
import { ProductTags } from './product-tags';
import { productFallback } from './product-visual';

/** Card grande da seção "Os mais pedidos". */
export function FeaturedCard({ product }: { product: Product }) {
  const { open } = useProductActions();
  const price = formatPrice(getStartingPrice(product));
  const visual = productFallback(product);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.05] transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="relative">
        <SmartImage
          src={product.image}
          alt={`Pizza ${product.name}`}
          sizes="(min-width: 1024px) 26rem, (min-width: 640px) 45vw, 82vw"
          className="aspect-[4/3]"
          imgClassName="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.05]"
          {...visual}
        />
        <ProductTags tags={product.tags} className="absolute top-4 left-4" />
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-display text-[1.6rem] leading-tight font-medium">
          <button
            type="button"
            onClick={() => open(product)}
            className="text-left after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-tomato-500"
          >
            {product.name}
            <span className="sr-only">, ver opções e adicionar</span>
          </button>
        </h3>
        <p className="mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-500">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="leading-tight">
            {hasMultiplePrices(product) && <span className="block text-xs text-ink-400">a partir de</span>}
            <span className="text-xl font-bold tracking-tight text-ink-900">{price}</span>
          </p>
          <span
            aria-hidden
            className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 pr-5 pl-4 text-sm font-semibold text-cream-50 transition-colors duration-300 group-hover:bg-tomato-500"
          >
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />
            Adicionar
          </span>
        </div>
      </div>
    </article>
  );
}
