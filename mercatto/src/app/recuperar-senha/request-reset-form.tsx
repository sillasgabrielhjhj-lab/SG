"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { requestPasswordResetAction, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success" role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">E-mail cadastrado</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Enviar instruções
      </Button>
    </form>
  );
}
