'use client';

import { AnimatePresence, m, type Variants } from 'framer-motion';
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------
 * Pilha de diálogos abertos: só o do topo responde a Esc e prende o foco.
 * Bloqueio de rolagem com contagem (diálogos podem se sobrepor).
 * ------------------------------------------------------------------ */
const stack: string[] = [];
let lockCount = 0;

function lock() {
  if (lockCount++ > 0) return;
  document.documentElement.classList.add('scroll-locked');
  document.getElementById('app-shell')?.setAttribute('inert', '');
}

function unlock() {
  if (--lockCount > 0) return;
  lockCount = 0;
  document.documentElement.classList.remove('scroll-locked');
  document.getElementById('app-shell')?.removeAttribute('inert');
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  );
}

const ease = [0.16, 1, 0.3, 1] as const;

const panelVariants: Record<string, Variants> = {
  right: {
    hidden: { x: '100%' },
    visible: { x: 0, transition: { duration: 0.45, ease } },
    exit: { x: '100%', transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
  },
  bottom: {
    hidden: { y: '100%' },
    visible: { y: 0, transition: { duration: 0.45, ease } },
    exit: { y: '100%', transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  },
  center: {
    hidden: { opacity: 0, scale: 0.97, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease } },
    exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.18 } },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  },
};

export type DialogVariant = 'drawer' | 'sheet' | 'fullscreen';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id do título visível (preferível) */
  labelledBy?: string;
  /** rótulo acessível quando não há título visível */
  label?: string;
  variant?: DialogVariant;
  className?: string;
  children: ReactNode;
}

export function Dialog(props: DialogProps) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(<AnimatePresence>{props.open && <DialogPanel {...props} />}</AnimatePresence>, document.body);
}

function DialogPanel({ onClose, labelledBy, label, variant = 'sheet', className, children }: DialogProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(id);
    lock();

    const panel = panelRef.current;
    const autofocus = panel?.querySelector<HTMLElement>('[data-autofocus]');
    (autofocus ?? panel)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id || !panelRef.current) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.lastIndexOf(id);
      if (index >= 0) stack.splice(index, 1);
      unlock();
      // Devolve o foco para quem abriu o diálogo (se ainda estiver na página).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [id]);

  const motionKey =
    variant === 'drawer' ? 'right' : variant === 'fullscreen' ? 'fade' : isDesktop ? 'center' : 'bottom';

  return (
    <div className="fixed inset-0 z-[60]">
      <m.div
        aria-hidden="true"
        className={cn(
          'absolute inset-0',
          variant === 'fullscreen' ? 'bg-ink-950/95' : 'bg-ink-950/55 backdrop-blur-[2px]',
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
        onClick={onClose}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex',
          variant === 'drawer' && 'justify-end',
          variant === 'sheet' && 'items-end justify-center md:items-center md:p-6',
          variant === 'fullscreen' && 'items-center justify-center',
        )}
      >
        <m.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : label}
          tabIndex={-1}
          variants={panelVariants[motionKey]}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'pointer-events-auto relative flex flex-col outline-none',
            variant === 'drawer' && 'h-full w-full max-w-md bg-cream-50 shadow-2xl',
            variant === 'sheet' &&
              'max-h-[92dvh] w-full overflow-hidden rounded-t-[1.75rem] bg-cream-50 shadow-2xl md:max-h-[min(88dvh,52rem)] md:max-w-4xl md:rounded-[1.75rem]',
            variant === 'fullscreen' && 'h-full w-full',
            className,
          )}
        >
          {children}
        </m.div>
      </div>
    </div>
  );
}
