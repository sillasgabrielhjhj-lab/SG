'use client';

import { Minus, Plus, Trash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Nome do item, para os rótulos acessíveis. */
  itemName: string;
  size?: 'sm' | 'md';
  /** Mostra lixeira quando a quantidade é 1 (para remover do carrinho). */
  allowRemove?: boolean;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  itemName,
  size = 'md',
  allowRemove = false,
  className,
}: QuantityStepperProps) {
  const btn = cn(
    'inline-flex items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-900/[0.06] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tomato-500 disabled:opacity-35 disabled:hover:bg-transparent',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  const showTrash = allowRemove && value <= 1;

  return (
    <div
      role="group"
      aria-label={`Quantity of ${itemName}`}
      className={cn(
        'inline-flex items-center rounded-full border border-ink-900/10 bg-white',
        size === 'sm' ? 'p-0.5' : 'p-1',
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={!allowRemove && value <= min}
        aria-label={showTrash ? `Remove ${itemName}` : `Decrease quantity of ${itemName}`}
      >
        {showTrash ? <Trash className="size-4 text-tomato-600" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <output
        aria-live="polite"
        aria-label={`${value} ${value === 1 ? 'unit' : 'units'}`}
        className={cn('min-w-7 text-center font-semibold tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')}
      >
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase quantity of ${itemName}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
