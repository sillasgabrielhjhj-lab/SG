'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Field } from '@/components/ui/field';

/**
 * Campo numérico controlado que tolera o campo vazio durante a digitação.
 * `nullable`: vazio ⇒ onChange(null) (ex.: "sem limite").
 */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  step = 1,
  nullable,
  placeholder,
  suffix,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  placeholder?: string;
  suffix?: string;
  className?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText((t) => {
      const parsed = t.trim() === '' ? null : Number(t.replace(',', '.'));
      return parsed === value ? t : value === null ? '' : String(value);
    });
  }, [value]);

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
      <div className="relative">
        <input
          {...a11y}
          className={suffix ? 'input pr-14' : 'input'}
          type="text"
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          value={text}
          placeholder={placeholder}
          data-min={min}
          data-max={max}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (raw.trim() === '') {
              if (nullable) onChange(null);
              return;
            }
            const n = Number(raw.replace(',', '.'));
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setText(value === null ? '' : String(value))}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span> : null}
      </div>
      )}
    </Field>
  );
}
