import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api';

export function Spinner({ className, label = 'Carregando…' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <span className="h-4 w-4 animate-[spin-slow_0.8s_linear_infinite] rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-md bg-surface-2', className)} aria-hidden="true" />;
}

/** Placeholder de carregamento para blocos/tabelas. */
export function LoadingBlock({ rows = 4, label = 'Carregando…' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3 p-4 sm:p-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 rounded-full bg-surface-2 p-3 text-muted">{icon ?? <Icon name="info" size={22} />}</div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Não foi possível carregar', compact }: { error: unknown; onRetry?: () => void; title?: string; compact?: boolean }) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : 'Erro inesperado.';
  const code = error instanceof ApiError && !error.isNetwork ? error.code : null;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-6' : 'px-4 py-10')}>
      <div className="mb-3 rounded-full bg-danger-soft p-3 text-danger-ink">
        <Icon name="alert" size={22} />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {code ? <p className="mt-1 font-mono text-xs text-muted">código: {code}</p> : null}
      {onRetry ? (
        <Button size="sm" className="mt-4" onClick={onRetry} icon={<Icon name="refresh" size={14} />}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/** Aviso inline (informativo/alerta). */
export function Notice({ tone = 'info', title, children, className }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: 'border-info/30 bg-info-soft text-info-ink',
    warning: 'border-warning/40 bg-warning-soft text-warning-ink',
    danger: 'border-danger/40 bg-danger-soft text-danger-ink',
    success: 'border-success/40 bg-success-soft text-success-ink',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cn('rounded-lg border px-3 py-2.5 text-sm', styles, className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title ? 'mt-0.5' : '', 'text-[0.8125rem] leading-relaxed')}>{children}</div> : null}
    </div>
  );
}
