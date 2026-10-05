import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stepper do checkout (concluído / atual / pendente). */
export function ProgressSteps({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex w-full items-center", className)} aria-label="Etapas">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center gap-1">
              <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold transition-colors", done && "bg-brand-700 text-white", active && "bg-brand-700 text-white ring-4 ring-brand-100", !done && !active && "bg-line text-fg-muted")}>
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("hidden text-2xs font-semibold whitespace-nowrap sm:block", active ? "text-brand-800" : "text-fg-muted")}>{label}</span>
            </div>
            {i < steps.length - 1 ? <span className={cn("mx-1.5 h-0.5 flex-1 rounded-full sm:mb-4", done ? "bg-brand-600" : "bg-line")} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
