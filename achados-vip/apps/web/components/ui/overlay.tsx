'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** `center` = modal; `right` = gaveta lateral. */
  placement?: 'center' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** false: não fecha por clique fora/ESC (ex.: operação em andamento). */
  dismissible?: boolean;
}

const overlayStack: symbol[] = [];

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Base acessível de Modal/Drawer: role=dialog, aria-modal, trava de foco, ESC, restauração do foco. */
export function Overlay({ open, onClose, title, description, children, footer, placement = 'center', size = 'md', dismissible = true }: OverlayProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    // Foco inicial: primeiro campo do corpo; senão o próprio painel.
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
    (first ?? panel)?.focus({ preventScroll: true });

    const me = Symbol('overlay');
    overlayStack.push(me);
    const onKey = (e: KeyboardEvent) => {
      // Só o overlay do topo reage (modal sobre gaveta, por exemplo).
      if (overlayStack[overlayStack.length - 1] !== me) return;
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      overlayStack.splice(overlayStack.indexOf(me), 1);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted || !open) return null;

  const isDrawer = placement === 'right';
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-[fade-in_0.15s_ease-out] bg-slate-950/50" onClick={() => dismissible && onClose()} aria-hidden="true" />
      <div className={cn('pointer-events-none absolute inset-0 flex', isDrawer ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4')}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'pointer-events-auto flex max-h-full w-full flex-col bg-surface text-fg shadow-pop outline-none',
            isDrawer
              ? 'h-full animate-[slide-in-right_0.2s_ease-out] border-l border-line sm:max-w-xl lg:max-w-2xl'
              : cn('animate-[pop-in_0.15s_ease-out] rounded-t-2xl border border-line sm:rounded-2xl', SIZES[size]),
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} disabled={!dismissible} className="-mr-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50" aria-label="Fechar">
              <Icon name="x" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const Modal = (p: Omit<OverlayProps, 'placement'>) => <Overlay {...p} placement="center" />;
export const Drawer = (p: Omit<OverlayProps, 'placement'>) => <Overlay {...p} placement="right" />;
