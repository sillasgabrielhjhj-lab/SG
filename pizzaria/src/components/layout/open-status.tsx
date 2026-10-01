'use client';

import { useOpenStatus } from '@/hooks/use-open-status';
import { cn } from '@/lib/utils';

interface OpenStatusProps {
  tone?: 'light' | 'dark';
  showDetail?: boolean;
  className?: string;
}

/** Selo "Aberto agora · Fecha às 23:00", calculado no fuso da pizzaria. */
export function OpenStatusBadge({ tone = 'light', showDetail = true, className }: OpenStatusProps) {
  const status = useOpenStatus();

  if (!status) {
    return <span aria-hidden className={cn('inline-block h-7 w-40 rounded-full', tone === 'light' ? 'skeleton' : 'bg-cream-50/10', className)} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
        tone === 'light' ? 'bg-white/70 text-ink-700 shadow-[var(--shadow-ring)]' : 'bg-cream-50/10 text-cream-50',
        className,
      )}
    >
      <span className="relative flex size-2">
        {status.isOpen && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-basil-400 opacity-60" />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', status.isOpen ? 'bg-basil-400' : 'bg-tomato-400')} />
      </span>
      <span>
        {status.label}
        {showDetail && <span className={tone === 'light' ? 'text-ink-500' : 'text-cream-50/65'}> · {status.detail}</span>}
      </span>
    </span>
  );
}
