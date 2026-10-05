"use client";

import { forwardRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { formatCep, formatCnpj, formatCpf, formatPhone } from "@/lib/format";
import { centsToInput, parseBRL } from "@/lib/money";

type MaskKind = "cep" | "cpf" | "cnpj" | "phone";
const MASKS: Record<MaskKind, { fn: (v: string) => string; maxLength: number; inputMode: "numeric" | "tel"; autoComplete?: string }> = {
  cep: { fn: formatCep, maxLength: 9, inputMode: "numeric", autoComplete: "postal-code" },
  cpf: { fn: formatCpf, maxLength: 14, inputMode: "numeric" },
  cnpj: { fn: formatCnpj, maxLength: 18, inputMode: "numeric" },
  phone: { fn: formatPhone, maxLength: 15, inputMode: "tel", autoComplete: "tel" },
};

/** Input com máscara brasileira (o servidor sempre normaliza para dígitos). */
export const MaskedInput = forwardRef<HTMLInputElement, InputProps & { mask: MaskKind }>(function MaskedInput({ mask, onChange, value, defaultValue, ...props }, ref) {
  const m = MASKS[mask];
  const [inner, setInner] = useState(() => m.fn(String(defaultValue ?? "")));
  const controlled = value !== undefined;
  return (
    <Input
      ref={ref}
      inputMode={m.inputMode}
      autoComplete={m.autoComplete}
      maxLength={m.maxLength}
      value={controlled ? m.fn(String(value)) : inner}
      onChange={(e) => {
        e.target.value = m.fn(e.target.value);
        if (!controlled) setInner(e.target.value);
        onChange?.(e);
      }}
      {...props}
    />
  );
});

/** Entrada de preço em R$; envia centavos inteiros num campo oculto `name`. */
export function PriceInput({ name, defaultCents, onCentsChange, ...props }: Omit<InputProps, "name" | "defaultValue" | "onChange"> & { name?: string; defaultCents?: number | null; onCentsChange?: (cents: number | null) => void }) {
  const [text, setText] = useState(centsToInput(defaultCents ?? null));
  const cents = parseBRL(text);
  return (
    <>
      <Input
        inputMode="decimal"
        leading={<span className="text-sm font-medium">R$</span>}
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,]/g, "");
          setText(v);
          onCentsChange?.(parseBRL(v));
        }}
        onBlur={() => {
          if (cents !== null) setText(centsToInput(cents));
        }}
        {...props}
      />
      {name ? <input type="hidden" name={name} value={cents ?? ""} /> : null}
    </>
  );
}
