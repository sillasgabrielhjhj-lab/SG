"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type CartIndicator = {
  count: number;
  setCount: (n: number) => void;
  bumpKey: number;
  bump: () => void;
  miniCartOpen: boolean;
  openMiniCart: () => void;
  closeMiniCart: () => void;
};

const Ctx = createContext<CartIndicator | null>(null);

/** Estado global leve do carrinho no cliente: contador do header e mini-carrinho. */
export function CartIndicatorProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [count, setCount] = useState(initialCount);
  const [bumpKey, setBumpKey] = useState(0);
  const [miniCartOpen, setOpen] = useState(false);
  const bump = useCallback(() => setBumpKey((k) => k + 1), []);
  const value = useMemo(
    () => ({ count, setCount, bumpKey, bump, miniCartOpen, openMiniCart: () => setOpen(true), closeMiniCart: () => setOpen(false) }),
    [count, bumpKey, bump, miniCartOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCartIndicator() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCartIndicator deve ser usado dentro de <CartIndicatorProvider>.");
  return ctx;
}
