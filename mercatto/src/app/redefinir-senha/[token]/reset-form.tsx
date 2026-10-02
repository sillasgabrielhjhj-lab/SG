"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { resetPasswordAction, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {state.message}
        </p>
        <Button asChild size="lg">
          <Link href="/entrar">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1.5"
        />
        <FieldError errors={state.fieldErrors?.password} />
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Redefinir senha
      </Button>
    </form>
  );
}
