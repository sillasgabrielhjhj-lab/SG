import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function CatalogPagination({
  basePath,
  searchParams,
  page,
  pageCount,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page") continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-1">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted",
          page === 1 && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="size-4" />
      </Link>

      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && pages[i - 1] !== p - 1 && (
            <span className="px-1 text-muted-foreground">…</span>
          )}
          <Link
            href={hrefFor(p)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-sm",
              p === page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={hrefFor(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted",
          page === pageCount && "pointer-events-none opacity-40",
        )}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
