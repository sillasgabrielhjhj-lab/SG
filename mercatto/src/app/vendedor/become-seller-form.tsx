"use client";

import { useActionState } from "react";
import { Store, Loader2 } from "lucide-react";

import { becomeSellerAction } from "@/lib/actions/seller";
import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function BecomeSellerForm() {
  const [state, formAction, isPending] = useActionState(becomeSellerAction, initialState);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border p-8 text-center">
      <Store className="mx-auto size-10 text-primary" />
      <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
        Comece a vender na Mercatto
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie sua loja para cadastrar produtos e começar a vender.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4 text-left">
        <div>
          <Label htmlFor="storeName">Nome da loja</Label>
          <Input id="storeName" name="storeName" required className="mt-1.5" />
          <FieldError errors={state.fieldErrors?.storeName} />
        </div>
        <div>
          <Label htmlFor="description">Sobre a loja (opcional)</Label>
          <Textarea id="description" name="description" className="mt-1.5" />
        </div>

        {state.status === "error" && state.message && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Criar minha loja
        </Button>
      </form>
    </div>
  );
}
