import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-14", className)}>
      {icon ? <div className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-700 [&_svg]:size-7">{icon}</div> : null}
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
