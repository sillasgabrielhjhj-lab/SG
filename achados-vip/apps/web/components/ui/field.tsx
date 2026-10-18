'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}
import { cn } from '@/lib/cn';

/**
 * Campo de formulário: rótulo + controle + dica/erro, ligando `id`, `aria-describedby` e `aria-invalid`.
 * O filho é um único elemento (input/select/textarea) ou uma função que recebe as props de acessibilidade
 * (útil quando o controle precisa de um wrapper).
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement<Record<string, unknown>> | ((props: ControlProps) => ReactNode);
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const control =
    typeof children === 'function'
      ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
      : isValidElement(children)
        ? cloneElement(children, {
            id,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
            required: required || (children.props.required as boolean | undefined),
          })
        : children;
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="mt-1 text-xs font-medium text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
