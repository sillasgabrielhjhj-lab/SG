"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/features/catalog/types";
import { CategoryIcon } from "@/components/layout/category-icon";

/** Mega-menu de categorias (desktop): coluna de raízes + painel de subcategorias. */
export function CategoriesMenu({ categories }: { categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = categories[active];
  return (
    <div ref={root} className="relative" onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-white hover:bg-white/10 focus-ring">
        <LayoutGrid className="size-4" aria-hidden />
        Categorias
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && categories.length ? (
        <div className="absolute top-full left-0 z-50 flex w-[720px] max-w-[calc(100vw-2rem)] animate-scale-in overflow-hidden rounded-card border border-line bg-surface text-fg shadow-popover">
          <ul className="w-60 shrink-0 border-r border-line bg-surface-muted py-2">
            {categories.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/categoria/${c.slug}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-2.5 px-4 py-2 text-sm focus-ring", i === active ? "bg-surface font-semibold text-brand-800" : "text-fg hover:text-brand-800")}
                >
                  <CategoryIcon name={c.icon} className="size-4 text-brand-700" />
                  <span className="flex-1">{c.name}</span>
                  {c.children.length ? <ChevronRight className="size-4 text-fg-subtle" aria-hidden /> : null}
                </Link>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="flex-1 p-5">
              <Link href={`/categoria/${current.slug}`} onClick={() => setOpen(false)} className="text-base font-bold text-fg hover:text-brand-700">
                {current.name}
              </Link>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                {current.children.map((ch) => (
                  <li key={ch.id}>
                    <Link href={`/categoria/${ch.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-brand-50 hover:text-brand-800 focus-ring">
                      <CategoryIcon name={ch.icon} className="size-4" />
                      {ch.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/categoria/${current.slug}`} onClick={() => setOpen(false)} className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
                Ver tudo em {current.name}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
