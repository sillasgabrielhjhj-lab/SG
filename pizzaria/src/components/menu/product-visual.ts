import type { FallbackKind } from '@/components/ui/smart-image';
import type { Product } from '@/types/menu';

/** Ícone e tom usados quando o produto não tem foto. */
export function productFallback(product: Product): { fallback: FallbackKind; tone: 'cream' | 'tomato' | 'basil' } {
  switch (product.category) {
    case 'bebidas':
      return { fallback: 'drink', tone: 'basil' };
    case 'doces':
    case 'sobremesas':
      return { fallback: 'dessert', tone: 'tomato' };
    case 'combos':
      return { fallback: 'combo', tone: 'cream' };
    default:
      return { fallback: 'pizza', tone: 'cream' };
  }
}
