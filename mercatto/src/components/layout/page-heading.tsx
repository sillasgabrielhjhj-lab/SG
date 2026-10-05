import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cabeçalho padrão das páginas internas de painéis. */
export function PageHeading({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
