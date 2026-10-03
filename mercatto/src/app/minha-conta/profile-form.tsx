"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { updateProfileAction } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function ProfileForm({
  defaultName,
  defaultPhone,
}: {
  defaultName: string;
  defaultPhone: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" defaultValue={defaultName} required className="mt-1.5" />
          <FieldError errors={state.fieldErrors?.name} />
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={defaultPhone} className="mt-1.5" />
          <FieldError errors={state.fieldErrors?.phone} />
        </div>
      </div>

      {state.status === "success" && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Salvar alterações
      </Button>
    </form>
  );
}
