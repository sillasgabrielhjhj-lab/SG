"use client";

import { useActionState } from "react";
import { Loader2, Truck } from "lucide-react";

import { advanceOrderStatusAction } from "@/lib/actions/seller";
import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { status: "idle" };

const NEXT_LABEL: Record<string, string> = {
  PAYMENT_APPROVED: "Marcar como preparando envio",
  PREPARING_SHIPMENT: "Marcar como enviado",
  SHIPPED: "Marcar como em trânsito",
  IN_TRANSIT: "Marcar como entregue",
};

export function AdvanceStatusForm({ orderNumber, currentStatus }: { orderNumber: string; currentStatus: string }) {
  const [state, formAction, isPending] = useActionState(advanceOrderStatusAction, initialState);
  const label = NEXT_LABEL[currentStatus];

  if (!label) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-5">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <Truck className="size-4" /> Atualizar status
      </h3>

      {currentStatus === "PREPARING_SHIPMENT" && (
        <div>
          <Label htmlFor="trackingCode">Código de rastreio (opcional)</Label>
          <Input id="trackingCode" name="trackingCode" className="mt-1.5" />
        </div>
      )}

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
    </form>
  );
}
