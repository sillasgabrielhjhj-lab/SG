import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Estado vazio: ícone em anéis suaves, título, orientação e ação (entrada sutil). */
export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex animate-fade-up flex-col items-center justify-center px-4 text-center", compact ? "gap-2 py-8" : "gap-3 py-14", className)}>
      {icon ? (
        <div className={cn("relative grid place-items-center", compact ? "size-16" : "size-24")} aria-hidden>
          <span className="absolute inset-0 rounded-full bg-brand-50" />
          <span className={cn("absolute rounded-full bg-brand-100/70", compact ? "inset-2.5" : "inset-4")} />
          <span className={cn("relative grid place-items-center rounded-full bg-surface text-brand-700 shadow-card ring-1 ring-brand-100", compact ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-7")}>{icon}</span>
        </div>
      ) : null}
      <h2 className={cn("font-bold text-balance text-fg", compact ? "text-base" : "text-lg sm:text-xl")}>{title}</h2>
      {description ? <p className="max-w-md text-sm text-balance text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
