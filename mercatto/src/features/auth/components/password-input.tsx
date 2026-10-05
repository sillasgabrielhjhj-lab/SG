"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      trailing={
        <button type="button" onClick={() => setVisible((v) => !v)} className="grid size-9 place-items-center rounded-md text-fg-subtle hover:text-fg focus-ring" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

/** Indicador simples de força de senha (orientação, não bloqueio). */
export function PasswordStrength({ value }: { value: string }) {
  const score = [value.length >= 8, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value), value.length >= 12].filter(Boolean).length;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte", "Excelente"];
  const colors = ["bg-danger-600", "bg-danger-600", "bg-warning-600", "bg-warning-600", "bg-success-600", "bg-success-600"];
  if (!value) return null;
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? colors[score] : "bg-line"}`} />
        ))}
      </div>
      <span className="text-xs text-fg-muted">{labels[score]}</span>
    </div>
  );
}
