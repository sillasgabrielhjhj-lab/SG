'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { LOG_LEVEL } from '@/lib/labels';
import type { NotificationDTO } from '@/lib/types';

export function NotificationsList({ items, onChanged, limit, emptyText = 'Nenhum alerta.' }: { items: NotificationDTO[]; onChanged: () => void; limit?: number; emptyText?: string }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) return <EmptyState title={emptyText} />;

  const markRead = async (id: string) => {
    setBusyId(id);
    try {
      await api.markNotificationRead(id);
      onChanged();
    } catch (e) {
      toast.fromError(e, 'Não foi possível marcar como lida');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="divide-y divide-line">
      {shown.map((n) => {
        const lvl = LOG_LEVEL[n.level] ?? { label: n.level, tone: 'neutral' as const };
        return (
          <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={lvl.tone}>{lvl.label}</Badge>
                <p className={n.read ? 'text-sm text-muted' : 'text-sm font-medium text-fg'}>{n.title}</p>
              </div>
              {n.body ? <p className="mt-1 break-words text-xs text-muted">{n.body}</p> : null}
              <p className="mt-1 text-[11px] text-muted">{formatDateTime(n.createdAt)}</p>
            </div>
            {!n.read ? (
              <Button size="sm" variant="ghost" onClick={() => void markRead(n.id)} loading={busyId === n.id}>
                Marcar como lida
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
