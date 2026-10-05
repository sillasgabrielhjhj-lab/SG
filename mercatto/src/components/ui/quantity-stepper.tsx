"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({ value, onChange, min = 1, max = 99, disabled, size = "md", label = "Quantidade", className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean; size?: "sm" | "md"; label?: string; className?: string }) {
  const btn = cn("grid shrink-0 place-items-center text-fg-muted transition-colors hover:bg-surface-muted hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent focus-ring", size === "sm" ? "size-8" : "size-10");
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center overflow-hidden rounded-field border border-line-strong bg-surface", disabled && "opacity-60", className)}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min} aria-label="Diminuir quantidade">
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) onChange(clamp(Math.floor(n)));
        }}
        className={cn("w-10 border-x border-line bg-transparent text-center text-sm font-semibold tabular focus:outline-none", size === "sm" ? "h-8" : "h-10")}
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label="Aumentar quantidade">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
