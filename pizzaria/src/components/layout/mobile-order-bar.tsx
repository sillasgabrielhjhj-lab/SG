'use client';

import { AnimatePresence, m } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCartSummary } from '@/hooks/use-cart-summary';
import { useScrolled } from '@/hooks/use-scrolled';
import { formatCents } from '@/lib/format';
import { useUI } from '@/store/ui';

/** Barra fixa no celular: "Order now" ou, com itens, atalho para a sacola. */
export function MobileOrderBar() {
  const { totals } = useCartSummary();
  const openCart = useUI((s) => s.openCart);
  const scrolled = useScrolled(240);
  const hasItems = totals.itemCount > 0;
  const visible = hasItems || scrolled;

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {hasItems ? (
            <button
              type="button"
              onClick={() => openCart()}
              className="flex h-14 w-full items-center gap-3 rounded-full bg-ink-900 pr-2 pl-5 text-cream-50 shadow-[0_16px_40px_-12px_rgb(17_14_12/0.7)] active:scale-[0.98]"
            >
              <span className="relative">
                <ShoppingBag className="size-5" aria-hidden />
                <span className="absolute -top-2 -right-2.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-tomato-500 px-1 text-[0.625rem] font-bold">
                  {totals.itemCount}
                </span>
              </span>
              <span className="flex-1 text-left font-semibold">View cart</span>
              <span className="rounded-full bg-tomato-500 px-4 py-2.5 text-sm font-bold tabular-nums">
                {formatCents(totals.totalCents)}
              </span>
            </button>
          ) : (
            <a
              href="#menu"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-tomato-500 text-base font-bold text-white shadow-[0_16px_40px_-12px_rgb(227_27_44/0.8)] active:scale-[0.98]"
            >
              <span aria-hidden>🍕</span> Order now
            </a>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
