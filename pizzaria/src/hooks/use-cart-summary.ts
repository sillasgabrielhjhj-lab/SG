'use client';

import { useMemo } from 'react';
import { computeTotals, resolveCartItem, type ResolvedCartItem } from '@/lib/pricing';
import { useCart } from '@/store/cart';

/** Itens do carrinho já resolvidos (nomes, detalhes e preços) + totais. */
export function useCartSummary() {
  const items = useCart((s) => s.items);
  const mode = useCart((s) => s.mode);

  return useMemo(() => {
    const lines = items.map(resolveCartItem).filter((l): l is ResolvedCartItem => l !== null);
    return { lines, totals: computeTotals(lines, mode), mode };
  }, [items, mode]);
}
