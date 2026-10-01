'use client';

import { AnimatePresence, m } from 'framer-motion';
import { CircleCheck, X } from 'lucide-react';
import { useEffect } from 'react';
import { useUI } from '@/store/ui';

const DURATION = 3500;

/** Aviso rápido no rodapé da tela (ex.: "Adicionado à sacola"). */
export function Toaster() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);
  const openCart = useUI((s) => s.openCart);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, DURATION);
    return () => window.clearTimeout(id);
  }, [toast, dismiss]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 md:bottom-8"
    >
      <AnimatePresence>
        {toast && (
          <m.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink-900 py-2.5 pr-2 pl-4 text-sm text-cream-50 shadow-2xl"
          >
            <CircleCheck className="size-5 shrink-0 text-basil-400" aria-hidden />
            <p className="min-w-0 flex-1 truncate font-medium">{toast.message}</p>
            {toast.action === 'open-cart' && (
              <button
                type="button"
                onClick={() => openCart()}
                className="shrink-0 rounded-full bg-cream-50/10 px-3 py-1.5 text-xs font-bold text-cream-50 transition-colors hover:bg-cream-50/20"
              >
                View cart
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-full p-1.5 text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
            >
              <X className="size-4" aria-hidden />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
