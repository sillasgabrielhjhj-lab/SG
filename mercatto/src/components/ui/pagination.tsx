import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paginação por links (SEO-friendly). buildHref(page) mantém os filtros da URL. */
export function Pagination({ page, totalPages, buildHref, className }: { page: number; totalPages: number; buildHref: (page: number) => string; className?: string }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const item = "grid h-10 min-w-10 place-items-center rounded-field px-2 text-sm font-semibold transition-colors focus-ring";
  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-center gap-1", className)}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" className={cn(item, "text-fg-muted hover:bg-surface hover:text-brand-700")} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - sorted[i - 1]! > 1 ? <span className="px-1 text-fg-subtle">…</span> : null}
          {p === page ? (
            <span aria-current="page" className={cn(item, "bg-brand-700 text-white")}>
              {p}
            </span>
          ) : (
            <Link href={buildHref(p)} className={cn(item, "text-fg hover:bg-surface hover:text-brand-700")}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} rel="next" className={cn(item, "text-fg-muted hover:bg-surface hover:text-brand-700")} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
