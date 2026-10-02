"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { registerAction, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required className="mt-1.5" />
        <FieldError errors={state.fieldErrors?.name} />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Mínimo 8 caracteres, com maiúscula, minúscula e número.
        </p>
        <FieldError errors={state.fieldErrors?.password} />
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="mt-2">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Criar conta
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao continuar, você concorda com os{" "}
        <a href="/termos" className="underline hover:text-primary">Termos de uso</a> e a{" "}
        <a href="/privacidade" className="underline hover:text-primary">Política de privacidade</a>.
      </p>
    </form>
  );
}
