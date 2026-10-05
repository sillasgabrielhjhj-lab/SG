"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: ReactNode; content: ReactNode; count?: number };

/** Abas WAI-ARIA (setas, Home/End). */
export function Tabs({ items, defaultTab, className, listClassName }: { items: TabItem[]; defaultTab?: string; className?: string; listClassName?: string }) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setActive(items[next]!.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className={className}>
      <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line scrollbar-none", listClassName)}>
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus-ring",
              active === t.id ? "border-brand-700 text-brand-800" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-px text-xs text-fg-muted">{t.count}</span> : null}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id} className="animate-fade-in pt-4">
          {t.content}
        </div>
      ))}
    </div>
  );
}
