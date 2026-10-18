'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';

type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}
interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  /** Atalho: mostra erro de API com a mensagem do servidor. */
  fromError: (err: unknown, title?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fora do ToastProvider');
  return c;
}

const STYLES: Record<ToastTone, string> = {
  success: 'border-success/40',
  error: 'border-danger/50',
  info: 'border-info/40',
  warning: 'border-warning/50',
};
const ICON_STYLES: Record<ToastTone, string> = {
  success: 'text-success-ink bg-success-soft',
  error: 'text-danger-ink bg-danger-soft',
  info: 'text-info-ink bg-info-soft',
  warning: 'text-warning-ink bg-warning-soft',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d),
      info: (t, d) => push('info', t, d),
      warning: (t, d) => push('warning', t, d),
      fromError: (err, title = 'Não foi possível concluir a ação') => push('error', title, errorMessage(err)),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
            className={cn('pointer-events-auto flex w-full max-w-sm animate-[pop-in_0.15s_ease-out] items-start gap-3 rounded-xl border bg-surface p-3 shadow-pop', STYLES[t.tone])}
          >
            <span className={cn('mt-0.5 rounded-full p-1', ICON_STYLES[t.tone])}>
              <Icon name={t.tone === 'success' ? 'check' : t.tone === 'info' ? 'info' : 'alert'} size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.title}</p>
              {t.description ? <p className="mt-0.5 break-words text-xs text-muted">{t.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted hover:text-fg" aria-label="Dispensar notificação">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
