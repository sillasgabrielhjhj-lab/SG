'use client';

import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';

export function Pagination({ page, pageSize, total, onChange, busy }: { page: number; pageSize: number; total: number; onChange: (page: number) => void; busy?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:px-5">
      <p className="text-xs text-muted" aria-live="polite">
        {total === 0 ? 'Nenhum registro' : `Mostrando ${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(total)}`}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1 || busy} aria-label="Página anterior" icon={<Icon name="chevronLeft" size={14} />}>
          Anterior
        </Button>
        <span className="text-xs tabular-nums text-muted">
          Página {page} de {pages}
        </span>
        <Button size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages || busy} aria-label="Próxima página">
          Próxima
          <Icon name="chevronRight" size={14} />
        </Button>
      </div>
    </nav>
  );
}
