"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import type { ActionState } from "@/lib/actions/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { status: "idle" };

export function OrderActionDialog({
  orderNumber,
  triggerLabel,
  title,
  description,
  reasonLabel,
  action,
  variant = "outline",
}: {
  orderNumber: string;
  triggerLabel: string;
  title: string;
  description: string;
  reasonLabel: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  variant?: "outline" | "destructive";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <div>
            <Label htmlFor="reason">{reasonLabel}</Label>
            <Textarea id="reason" name="reason" required minLength={3} className="mt-1.5" />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <Button type="submit" disabled={isPending} variant={variant}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
