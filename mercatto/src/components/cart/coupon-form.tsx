"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, X, Loader2 } from "lucide-react";

import { applyCouponAction, removeCouponAction } from "@/lib/actions/cart";
import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { status: "idle" };

export function CouponForm({ appliedCode }: { appliedCode: string | null }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(applyCouponAction, initialState);
  const [isRemoving, startRemoving] = useTransition();

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5 text-success">
          <Tag className="size-3.5" /> Cupom {appliedCode} aplicado
        </span>
        <button
          type="button"
          disabled={isRemoving}
          onClick={() => startRemoving(async () => {
            await removeCouponAction();
            router.refresh();
          })}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remover cupom"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input name="code" placeholder="Cupom de desconto" className="h-9" />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Aplicar
        </Button>
      </div>
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}
