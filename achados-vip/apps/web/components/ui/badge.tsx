import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/labels';

const TONES: Record<Tone, string> = {
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  primary: 'bg-primary-soft text-primary-ink',
  neutral: 'bg-surface-2 text-muted',
};
const DOTS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  primary: 'bg-primary',
  neutral: 'bg-muted',
};

/** Selo de status: a informação nunca depende só da cor (há ponto + texto). */
export function Badge({ tone = 'neutral', children, dot = true, className, title }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[tone])} aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
