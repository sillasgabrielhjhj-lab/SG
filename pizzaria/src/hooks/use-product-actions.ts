'use client';

import { useCallback } from 'react';
import { isAvailable, needsCustomization } from '@/lib/menu';
import { useCart } from '@/store/cart';
import { useUI } from '@/store/ui';
import type { Product } from '@/types/menu';

/** Ações dos cards: abrir o produto ou adicionar direto (itens sem opções). */
export function useProductActions() {
  const openProduct = useUI((s) => s.openProduct);
  const showToast = useUI((s) => s.showToast);
  const addItem = useCart((s) => s.addItem);

  const open = useCallback((product: Product) => openProduct(product.id), [openProduct]);

  /** Adiciona direto se não houver nada para escolher; senão abre o produto. */
  const add = useCallback(
    (product: Product) => {
      if (!isAvailable(product)) return;
      if (needsCustomization(product)) {
        openProduct(product.id);
        return;
      }
      addItem({ productId: product.id, options: {} }, 1);
      showToast(`${product.name} added to cart`, 'open-cart');
    },
    [addItem, openProduct, showToast],
  );

  return { open, add };
}
