"use client";

import { useActionState, useState } from "react";
import { Plus, Loader2 } from "lucide-react";

import { createCouponAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function CouponFormDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await createCouponAction(prevState, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" /> Novo cupom
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cupom</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="code">Código</Label>
            <Input id="code" name="code" placeholder="BEMVINDO10" required className="mt-1.5 uppercase" />
            <FieldError errors={state.fieldErrors?.code} />
          </div>

          <div>
            <Label htmlFor="type">Tipo de desconto</Label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED")}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="value">{type === "PERCENTAGE" ? "Percentual de desconto" : "Valor do desconto (R$)"}</Label>
            <Input id="value" name="value" type="number" step={type === "PERCENTAGE" ? "1" : "0.01"} required className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="minOrder">Pedido mínimo (R$, opcional)</Label>
            <Input id="minOrder" name="minOrder" type="number" step="0.01" defaultValue="0" className="mt-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxUses">Limite de usos (opcional)</Label>
              <Input id="maxUses" name="maxUses" type="number" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="expiresAt">Expira em (opcional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" className="mt-1.5" />
            </div>
          </div>

          {state.status === "error" && state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Criar cupom
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
