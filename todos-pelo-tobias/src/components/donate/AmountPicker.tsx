"use client";

import { Check, CircleAlert } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { formatBRL, type AmountResult } from "@/lib/money";

export type Choice = { kind: "preset"; cents: number } | { kind: "custom" } | null;

interface AmountPickerProps {
  presetsCents: number[];
  choice: Choice;
  onPreset: (cents: number) => void;
  customText: string;
  onCustomText: (text: string) => void;
  /** Validação do valor digitado em "Outro valor". */
  customResult: AmountResult | null;
}

const chip =
  "flex h-[4.25rem] cursor-pointer items-center justify-center rounded-2xl border-2 border-brand-100 bg-white px-3 text-center text-lg font-extrabold text-brand-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:shadow-soft peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500";

const badge =
  "pointer-events-none absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-brand-600 text-white shadow transition duration-200";

/**
 * Cinco valores sugeridos + um campo "Outro valor" sempre visível (o 6º item da grade). Quem digita
 * ali escolhe qualquer valor, e o QR Code é gerado na hora, sem precisar tocar em mais nada.
 */
export function AmountPicker({
  presetsCents,
  choice,
  onPreset,
  customText,
  onCustomText,
  customResult,
}: AmountPickerProps) {
  const hintId = `${useId()}-dica`;
  const custom = choice?.kind === "custom";
  const invalid = custom && customText.trim() !== "" && customResult !== null && !customResult.ok;

  return (
    <fieldset>
      <legend className="text-lg font-extrabold text-brand-950">
        <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-brand-600 text-sm text-white">
          1
        </span>
        Escolha ou digite o valor da doação
      </legend>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {presetsCents.map((cents) => (
          <label key={cents} className="relative">
            <input
              type="radio"
              name="valor"
              className="peer sr-only"
              checked={choice?.kind === "preset" && choice.cents === cents}
              onChange={() => onPreset(cents)}
            />
            <span className={chip}>{formatBRL(cents)}</span>
            <span aria-hidden className={cn(badge, "scale-0 peer-checked:scale-100")}>
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          </label>
        ))}

        <label
          className={cn(
            "relative flex h-[4.25rem] cursor-text flex-col justify-center rounded-2xl border-2 px-3.5 shadow-sm transition duration-200 focus-within:ring-4",
            invalid
              ? "border-red-400 bg-white focus-within:border-red-500 focus-within:ring-red-100"
              : custom
                ? "border-brand-600 bg-brand-50 shadow-soft focus-within:ring-brand-100"
                : "border-brand-100 bg-white focus-within:border-brand-600 focus-within:ring-brand-100 hover:border-brand-300",
          )}
        >
          <span className="text-xs font-bold tracking-wide text-brand-700 uppercase">
            Outro valor
          </span>
          <span className="flex items-baseline gap-1.5">
            <span aria-hidden className="text-lg font-extrabold text-brand-700">
              R$
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={customText}
              onChange={(e) => onCustomText(e.target.value)}
              aria-label="Outro valor, em reais"
              aria-invalid={invalid}
              aria-describedby={hintId}
              className="min-w-0 flex-1 bg-transparent text-xl font-extrabold text-brand-950 outline-none placeholder:font-semibold placeholder:text-muted/80"
            />
          </span>
          <span aria-hidden className={cn(badge, custom && !invalid ? "scale-100" : "scale-0")}>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </label>
      </div>

      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "mt-3 flex min-h-6 items-start gap-1.5 text-sm",
          invalid ? "font-semibold text-red-700" : "text-muted",
        )}
      >
        {invalid && customResult && !customResult.ok ? (
          <>
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {customResult.message}
          </>
        ) : (
          "Toque em um valor ou digite o seu. Pode usar até duas casas decimais, ex.: 25 ou 25,50."
        )}
      </p>
    </fieldset>
  );
}
