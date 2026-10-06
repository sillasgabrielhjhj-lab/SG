"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";
type ToastOptions = { description?: ReactNode; action?: { label: string; onClick: () => void }; duration?: number };
type ToastItem = ToastOptions & { id: number; tone: ToastTone; title: ReactNode; leaving?: boolean };
type ToastApi = Record<ToastTone, (title: ReactNode, opts?: ToastOptions) => void> & { dismiss: (id: number) => void };

const ToastContext = createContext<ToastApi | null>(null);

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const tones = {
  success: "text-success-600",
  error: "text-danger-600",
  info: "text-info-600",
  warning: "text-warning-600",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  // Saída animada: marca como "saindo" e remove após a animação (180ms).
  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 190);
  }, []);
  const push = useCallback(
    (tone: ToastTone) => (title: ReactNode, opts: ToastOptions = {}) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { id, tone, title, ...opts }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (tone === "error" ? 6000 : 4000));
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: push("success"), error: push("error"), info: push("info"), warning: push("warning"), dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-(--z-toast) flex flex-col items-center gap-2 px-4 md:top-20 md:right-4 md:bottom-auto md:left-auto md:items-end lg:top-[7.5rem]">
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-popover", t.leaving ? "animate-toast-out" : "animate-toast-in")}>
              <Icon className={cn("mt-0.5 size-5 shrink-0 animate-check [animation-delay:80ms]", tones[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t.title}</p>
                {t.description ? <div className="mt-0.5 text-sm text-fg-muted">{t.description}</div> : null}
                {t.action ? (
                  <button type="button" onClick={() => (t.action!.onClick(), dismiss(t.id))} className="mt-1.5 text-sm font-semibold text-brand-700 hover:underline focus-ring">
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-surface-muted hover:text-fg focus-ring" aria-label="Fechar notificação">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>.");
  return ctx;
}
