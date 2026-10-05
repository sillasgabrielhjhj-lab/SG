"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldContextValue = { id: string; hintId: string; errorId: string; invalid: boolean; describedBy?: string; required?: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

/** Liga label, dica e erro ao controle (aria-describedby / aria-invalid) automaticamente. */
export function useFieldControl() {
  return useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  id: idProp,
  labelAction,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
  id?: string;
  labelAction?: ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const message = Array.isArray(error) ? error[0] : error;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, message ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, hintId, errorId, invalid: Boolean(message), describedBy, required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label ? (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className="text-sm font-medium text-fg">
              {label}
              {required ? (
                <span className="ml-0.5 text-danger-600" aria-hidden>
                  *
                </span>
              ) : null}
            </label>
            {labelAction}
          </div>
        ) : null}
        {children}
        {hint && !message ? (
          <p id={hintId} className="text-xs text-fg-subtle">
            {hint}
          </p>
        ) : null}
        {message ? (
          <p id={errorId} role="alert" className="animate-fade-in text-xs font-medium text-danger-700">
            {message}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
