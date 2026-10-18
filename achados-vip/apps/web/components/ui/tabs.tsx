'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number | null;
}

/** Abas acessíveis (WAI-ARIA): setas/Home/End navegam; use <TabPanel> com o mesmo id. */
export function Tabs({ items, value, onChange, label, idPrefix = 'tab' }: { items: TabItem[]; value: string; onChange: (id: string) => void; label: string; idPrefix?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const t = items[next]!;
      onChange(t.id);
      refs.current[t.id]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={`${idPrefix}-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-primary text-primary-ink' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && t.count !== null ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-muted">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, idPrefix = 'tab', children }: { id: string; active: boolean; idPrefix?: string; children: ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-${id}`} tabIndex={0} className="pt-4 outline-none">
      {children}
    </div>
  );
}
