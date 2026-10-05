"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { SORT_OPTIONS, type SortValue } from "@/features/search/schemas";

export function SortSelect({ value, hrefs }: { value: SortValue; hrefs: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <ArrowUpDown className="size-4 text-fg-subtle" aria-hidden />
      <span className="sr-only sm:not-sr-only sm:text-fg-muted">Ordenar por</span>
      <select value={value} onChange={(e) => router.push(hrefs[e.target.value] ?? "?", { scroll: false })} className="h-9 rounded-md border border-line-strong bg-surface pr-8 pl-2 text-sm font-semibold focus:border-brand-600 focus:shadow-focus focus:outline-none">
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Filtros em folha inferior no mobile (o conteúdo vem renderizado do servidor). */
export function MobileFilters({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold focus-ring lg:hidden">
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtrar
        {activeCount ? <span className="grid size-5 place-items-center rounded-full bg-brand-700 text-2xs text-white">{activeCount}</span> : null}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} side="bottom" title="Filtros">
        <div className="p-4" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {children}
        </div>
      </Drawer>
    </>
  );
}
