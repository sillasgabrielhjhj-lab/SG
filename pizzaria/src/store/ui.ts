'use client';

import { create } from 'zustand';

export type CartStep = 'cart' | 'checkout' | 'success';

export interface LastOrder {
  code: string;
  message: string;
  url: string;
}

export interface Toast {
  id: number;
  message: string;
  action?: 'open-cart';
}

interface UIState {
  /** Produto aberto no modal (e a linha do carrinho, quando editando). */
  product: { id: string; editLineId?: string } | null;
  cartOpen: boolean;
  cartStep: CartStep;
  mobileNavOpen: boolean;
  toast: Toast | null;
  lastOrder: LastOrder | null;

  openProduct: (id: string, editLineId?: string) => void;
  closeProduct: () => void;
  openCart: (step?: CartStep) => void;
  closeCart: () => void;
  setCartStep: (step: CartStep) => void;
  setMobileNav: (open: boolean) => void;
  showToast: (message: string, action?: Toast['action']) => void;
  dismissToast: () => void;
  setLastOrder: (order: LastOrder | null) => void;
}

let toastCounter = 0;

export const useUI = create<UIState>()((set) => ({
  product: null,
  cartOpen: false,
  cartStep: 'cart',
  mobileNavOpen: false,
  toast: null,
  lastOrder: null,

  openProduct: (id, editLineId) => set({ product: { id, editLineId }, mobileNavOpen: false }),
  closeProduct: () => set({ product: null }),
  openCart: (step = 'cart') => set({ cartOpen: true, cartStep: step, mobileNavOpen: false, toast: null }),
  closeCart: () => set({ cartOpen: false }),
  setCartStep: (cartStep) => set({ cartStep }),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  showToast: (message, action) => set({ toast: { id: ++toastCounter, message, action } }),
  dismissToast: () => set({ toast: null }),
  setLastOrder: (lastOrder) => set({ lastOrder }),
}));
