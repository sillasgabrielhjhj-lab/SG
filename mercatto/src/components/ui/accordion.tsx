import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Acordeão com <details>/<summary> nativos (acessível e sem JS). */
export function Accordion({ items, className }: { items: { id: string; title: ReactNode; content: ReactNode; open?: boolean }[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line rounded-card border border-line bg-surface", className)}>
      {items.map((item) => (
        <details key={item.id} open={item.open} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-fg select-none focus-ring [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-4 pb-4 text-sm text-fg-muted">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
