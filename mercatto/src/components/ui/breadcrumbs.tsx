import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-fg-muted scrollbar-none">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex shrink-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="rounded-sm hover:text-brand-700 hover:underline focus-ring">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "max-w-[50vw] truncate font-medium text-fg sm:max-w-md")}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight className="size-3.5 text-fg-subtle" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
