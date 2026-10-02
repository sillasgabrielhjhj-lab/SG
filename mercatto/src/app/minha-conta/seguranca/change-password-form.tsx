"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { changePasswordAction } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" key={state.status === "success" ? "reset" : "form"}>
      <div>
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5"
        />
        <FieldError errors={state.fieldErrors?.currentPassword} />
      </div>

      <div>
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1.5"
        />
        <FieldError errors={state.fieldErrors?.newPassword} />
      </div>

      {state.status === "success" && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Alterar senha
      </Button>
    </form>
  );
}
