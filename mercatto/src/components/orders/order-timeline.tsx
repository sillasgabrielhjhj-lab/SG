import { Check, X, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

const HAPPY_PATH = [
  "AWAITING_PAYMENT",
  "PAYMENT_APPROVED",
  "PREPARING_SHIPMENT",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
] as const;

function formatDate(date: Date | null | undefined) {
  if (!date) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function OrderTimeline({
  status,
  createdAt,
  paidAt,
  shippedAt,
  deliveredAt,
  cancelledAt,
  cancelReason,
}: {
  status: string;
  createdAt: Date;
  paidAt: Date | null | undefined;
  shippedAt: Date | null | undefined;
  deliveredAt: Date | null | undefined;
  cancelledAt: Date | null | undefined;
  cancelReason: string | null | undefined;
}) {
  // Cancelado/devolvido sai do caminho feliz — mostra só os dois pontos
  // que realmente aconteceram, não finge que o pedido ainda vai progredir.
  if (status === "CANCELLED" || status === "RETURNED") {
    return (
      <ol className="flex flex-col gap-4">
        <TimelineStep
          icon={<Check className="size-3.5" />}
          variant="done"
          label="Pedido feito"
          date={formatDate(createdAt)}
        />
        <TimelineStep
          icon={status === "CANCELLED" ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
          variant="destructive"
          label={ORDER_STATUS_LABELS[status]}
          date={formatDate(cancelledAt)}
          detail={cancelReason}
          isLast
        />
      </ol>
    );
  }

  const currentIndex = HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number]);
  const dates: Record<string, Date | null | undefined> = {
    AWAITING_PAYMENT: createdAt,
    PAYMENT_APPROVED: paidAt,
    SHIPPED: shippedAt,
    DELIVERED: deliveredAt,
  };

  return (
    <ol className="flex flex-col gap-4">
      {HAPPY_PATH.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <TimelineStep
            key={step}
            icon={isDone ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
            variant={isDone ? "done" : isActive ? "active" : "pending"}
            label={ORDER_STATUS_LABELS[step]}
            date={formatDate(dates[step])}
            isLast={index === HAPPY_PATH.length - 1}
          />
        );
      })}
    </ol>
  );
}

function TimelineStep({
  icon,
  variant,
  label,
  date,
  detail,
  isLast = false,
}: {
  icon: React.ReactNode;
  variant: "done" | "active" | "pending" | "destructive";
  label: string;
  date?: string | null;
  detail?: string | null;
  isLast?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            variant === "done" && "bg-success text-success-foreground",
            variant === "active" && "bg-primary text-primary-foreground",
            variant === "pending" && "bg-muted text-muted-foreground",
            variant === "destructive" && "bg-destructive text-destructive-foreground",
          )}
        >
          {icon}
        </div>
        {!isLast && <div className="mt-1 h-full min-h-6 w-px flex-1 bg-border" aria-hidden />}
      </div>
      <div className="pb-1">
        <p
          className={cn(
            "text-sm font-medium",
            variant === "pending" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
        </p>
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </div>
    </li>
  );
}
