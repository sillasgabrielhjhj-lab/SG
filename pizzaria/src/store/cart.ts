'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getUnitPriceCents, selectionKey } from '@/lib/pricing';
import { safeLocalStorage } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { CartItem, FulfillmentMode, ItemSelection } from '@/types/cart';

export const MAX_QUANTITY = 30;

interface CartState {
  items: CartItem[];
  mode: FulfillmentMode;
  /** Adiciona (ou soma à linha idêntica existente). */
  addItem: (selection: ItemSelection, quantity: number) => void;
  /** Substitui uma linha existente (edição a partir do carrinho). */
  replaceItem: (lineId: string, selection: ItemSelection, quantity: number) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  setMode: (mode: FulfillmentMode) => void;
}

const clampQty = (q: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.round(q)));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      mode: 'delivery',

      addItem: (selection, quantity) =>
        set((state) => {
          const key = selectionKey(selection);
          const existing = state.items.find((i) => selectionKey(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === existing.lineId ? { ...i, quantity: clampQty(i.quantity + quantity) } : i,
              ),
            };
          }
          return { items: [...state.items, { ...selection, lineId: uid(), quantity: clampQty(quantity) }] };
        }),

      replaceItem: (lineId, selection, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.lineId === lineId ? { ...selection, lineId, quantity: clampQty(quantity) } : i,
          ),
        })),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.lineId !== lineId)
              : state.items.map((i) => (i.lineId === lineId ? { ...i, quantity: clampQty(quantity) } : i)),
        })),

      removeItem: (lineId) => set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),

      clear: () => set({ items: [] }),

      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'pizzaria:cart',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items, mode: state.mode }),
      // Descarta itens que não existem mais no cardápio (ou dados corrompidos).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<CartState, 'items' | 'mode'>>;
        const items = Array.isArray(saved.items)
          ? saved.items.filter(
              (i): i is CartItem =>
                Boolean(i) &&
                typeof i.lineId === 'string' &&
                typeof i.productId === 'string' &&
                typeof i.quantity === 'number' &&
                typeof i.options === 'object' &&
                i.options !== null &&
                getUnitPriceCents(i) !== null,
            )
          : [];
        const mode = saved.mode === 'pickup' ? 'pickup' : 'delivery';
        return { ...current, items: items.map((i) => ({ ...i, quantity: clampQty(i.quantity) })), mode };
      },
    },
  ),
);
