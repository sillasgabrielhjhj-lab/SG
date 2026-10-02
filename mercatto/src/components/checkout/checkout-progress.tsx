import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckoutStep = "endereco" | "entrega" | "pagamento" | "revisao" | "confirmacao";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "endereco", label: "Endereço" },
  { id: "entrega", label: "Entrega" },
  { id: "pagamento", label: "Pagamento" },
  { id: "revisao", label: "Revisão" },
  { id: "confirmacao", label: "Confirmação" },
];

export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2 sm:gap-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-medium",
                isDone && "bg-success text-success-foreground",
                isActive && "bg-primary text-primary-foreground",
                !isDone && !isActive && "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium sm:text-sm",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div className="mx-1 h-px w-4 bg-border sm:w-8" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
