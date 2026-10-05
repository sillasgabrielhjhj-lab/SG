import { Check, Circle, MapPin, Truck, XCircle } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { formatCep, formatDateTime, formatPhone } from "@/lib/format";
import { ORDER_STATUS_LABELS, orderStatusBadgeClass, type TimelineStep } from "@/features/orders/state-machine";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", orderStatusBadgeClass(status), className)}>{ORDER_STATUS_LABELS[status]}</span>;
}

const NEGATIVE: OrderStatus[] = ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"];

/** Linha do tempo vertical do pedido (fluxo feliz + desvios). */
export function OrderTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const negative = NEGATIVE.includes(step.status);
        return (
          <li key={`${step.status}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden className={cn("absolute top-7 bottom-0 left-[13px] w-0.5", step.state === "done" ? "bg-brand-600" : "bg-line")} /> : null}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border-2",
                negative && step.state !== "upcoming" ? "border-danger-600 bg-danger-50 text-danger-600" : step.state === "done" ? "border-brand-600 bg-brand-600 text-white" : step.state === "current" ? "border-brand-600 bg-surface text-brand-700" : "border-line-strong bg-surface text-fg-subtle",
              )}
            >
              {negative && step.state !== "upcoming" ? <XCircle className="size-4" /> : step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : step.status === "SHIPPED" || step.status === "IN_TRANSIT" ? <Truck className="size-3.5" /> : <Circle className={cn("size-2.5", step.state === "current" && "fill-current")} />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm font-semibold", step.state === "upcoming" ? "text-fg-subtle" : "text-fg")}>
                {step.label}
                {step.state === "current" ? <span className="sr-only"> (etapa atual)</span> : null}
              </p>
              {step.at ? <p className="text-xs text-fg-muted">{formatDateTime(step.at)}</p> : null}
              {step.note ? <p className="mt-0.5 text-xs text-fg-muted">{step.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type AddressSnapshot = { recipientName: string; phone: string | null; cep: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; reference: string | null };

export function AddressBlock({ address, className }: { address: unknown; className?: string }) {
  const a = address as AddressSnapshot | null;
  if (!a) return null;
  return (
    <address className={cn("flex gap-2.5 text-sm not-italic", className)}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
      <span className="min-w-0">
        <span className="block font-semibold">{a.recipientName}</span>
        <span className="block text-fg-muted">
          {a.street}, {a.number}
          {a.complement ? ` — ${a.complement}` : ""}
        </span>
        <span className="block text-fg-muted">
          {a.district} · {a.city}/{a.state} · CEP {formatCep(a.cep)}
        </span>
        {a.reference ? <span className="block text-xs text-fg-subtle">Ref.: {a.reference}</span> : null}
        {a.phone ? <span className="block text-xs text-fg-subtle">{formatPhone(a.phone)}</span> : null}
      </span>
    </address>
  );
}
