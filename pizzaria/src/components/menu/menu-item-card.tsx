'use client';

import { Plus } from 'lucide-react';
import { SmartImage } from '@/components/ui/smart-image';
import { useProductActions } from '@/hooks/use-product-actions';
import { formatPrice } from '@/lib/format';
import { getStartingPrice, hasMultiplePrices, isAvailable, needsCustomization } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/menu';
import { ProductTags } from './product-tags';
import { productFallback } from './product-visual';

/** Item compacto do cardápio (estilo app de delivery: texto à esquerda, foto à direita). */
export function MenuItemCard({ product }: { product: Product }) {
  const { open, add } = useProductActions();
  const available = isAvailable(product);
  const quickAdd = available && !needsCustomization(product);

  return (
    <article
      className={cn(
        'group relative flex h-full gap-4 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.05] transition-[box-shadow,transform] duration-300 sm:p-4',
        available ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]' : 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <h4 className="text-display text-lg leading-snug font-medium sm:text-xl">
          <button
            type="button"
            onClick={() => open(product)}
            className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-tomato-500"
          >
            {product.name}
            <span className="sr-only">, ver detalhes</span>
          </button>
        </h4>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-500">{product.description}</p>
        {product.serves && <p className="mt-1 text-xs font-medium text-ink-400">{product.serves}</p>}
        <ProductTags tags={product.tags} size="xs" className="mt-2.5" />
        <p className="mt-auto pt-3 text-[0.9375rem] font-bold text-ink-900">
          {!available ? (
            <span className="text-tomato-700">Esgotado</span>
          ) : (
            <>
              {hasMultiplePrices(product) && <span className="mr-1 text-xs font-medium text-ink-400">a partir de</span>}
              {formatPrice(getStartingPrice(product))}
            </>
          )}
        </p>
      </div>

      <div className="relative shrink-0 self-start">
        <SmartImage
          src={product.image}
          alt={product.name}
          sizes="128px"
          className="size-28 rounded-xl sm:size-32"
          imgClassName="transition-transform duration-700 group-hover:scale-105"
          {...productFallback(product)}
        />
        {available &&
          (quickAdd ? (
            <button
              type="button"
              onClick={() => add(product)}
              aria-label={`Adicionar ${product.name} à sacola`}
              className="absolute -right-1.5 -bottom-1.5 z-10 inline-flex size-10 items-center justify-center rounded-full bg-tomato-500 text-white shadow-lg ring-4 ring-white transition-transform hover:scale-105 active:scale-95"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          ) : (
            <span
              aria-hidden
              className="absolute -right-1.5 -bottom-1.5 inline-flex size-10 items-center justify-center rounded-full bg-tomato-500 text-white shadow-lg ring-4 ring-white transition-transform group-hover:scale-105"
            >
              <Plus className="size-5" />
            </span>
          ))}
      </div>
    </article>
  );
}
