"use client";

import { Check, CircleAlert } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { formatBRL, type AmountResult } from "@/lib/money";

export type Choice = { kind: "preset"; cents: number } | { kind: "custom" } | null;

interface AmountPickerProps {
  presetsCents: number[];
  choice: Choice;
  onChoice: (choice: NonNullable<Choice>) => void;
  customText: string;
  onCustomText: (text: string) => void;
  /** Validação do valor digitado em "Outro valor". */
  customResult: AmountResult | null;
}

const chip =
  "flex h-[4.25rem] cursor-pointer items-center justify-center rounded-2xl border-2 border-brand-100 bg-white px-3 text-center text-lg font-extrabold text-brand-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:shadow-soft peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500";

const badge =
  "pointer-events-none absolute -top-2 -right-2 grid size-6 scale-0 place-items-center rounded-full bg-brand-600 text-white shadow transition duration-200 peer-checked:scale-100";

export function AmountPicker({
  presetsCents,
  choice,
  onChoice,
  customText,
  onCustomText,
  customResult,
}: AmountPickerProps) {
  const inputId = useId();
  const hintId = `${inputId}-dica`;
  const custom = choice?.kind === "custom";
  const invalid = custom && customText.trim() !== "" && customResult !== null && !customResult.ok;

  return (
    <fieldset>
      <legend className="text-lg font-extrabold text-brand-950">
        <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-brand-600 text-sm text-white">1</span>
        Escolha o valor da doação
      </legend>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {presetsCents.map((cents) => (
          <label key={cents} className="relative">
            <input
              type="radio"
              name="valor"
              className="peer sr-only"
              checked={choice?.kind === "preset" && choice.cents === cents}
              onChange={() => onChoice({ kind: "preset", cents })}
            />
            <span className={chip}>{formatBRL(cents)}</span>
            <span aria-hidden className={badge}>
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          </label>
        ))}
        <label className="relative col-span-2 sm:col-span-1">
          <input type="radio" name="valor" className="peer sr-only" checked={custom} onChange={() => onChoice({ kind: "custom" })} />
          <span className={chip}>Outro valor</span>
          <span aria-hidden className={badge}>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </label>
      </div>

      {custom ? (
        <div className="mt-5 animate-pop">
          <label htmlFor={inputId} className="block text-sm font-bold text-brand-900">
            Digite o valor que deseja doar
          </label>
          <div className="relative mt-2">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-xl font-extrabold text-brand-700">
              R$
            </span>
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="0,00"
              value={customText}
              onChange={(e) => onCustomText(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={hintId}
              className={cn(
                "h-16 w-full rounded-2xl border-2 bg-white pr-5 pl-14 text-2xl font-extrabold text-brand-950 shadow-sm transition outline-none placeholder:text-brand-200 focus:ring-4",
                invalid
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-brand-200 focus:border-brand-600 focus:ring-brand-100",
              )}
            />
          </div>
          <p
            id={hintId}
            aria-live="polite"
            className={cn("mt-2 flex min-h-6 items-start gap-1.5 text-sm", invalid ? "font-semibold text-red-700" : "text-muted")}
          >
            {invalid && customResult && !customResult.ok ? (
              <>
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {customResult.message}
              </>
            ) : (
              "Pode usar até duas casas decimais. Exemplos: 25 ou 25,50."
            )}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
