"use client";

import { useActionState, useState } from "react";
import { Plus, Loader2 } from "lucide-react";

import { createAddressAction } from "@/lib/actions/account";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/auth/field-error";

const initialState: ActionState = { status: "idle" };

export function AddressFormDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await createAddressAction(prevState, formData);
      if (result.status === "success") {
        setOpen(false);
        onCreated?.();
      }
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Adicionar endereço
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo endereço</DialogTitle>
          <DialogDescription>Preencha os dados de entrega.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="label">Identificação (opcional)</Label>
            <Input id="label" name="label" placeholder="Ex: Casa, Trabalho" className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="recipientName">Nome do destinatário</Label>
            <Input id="recipientName" name="recipientName" required className="mt-1.5" />
            <FieldError errors={state.fieldErrors?.recipientName} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zipCode">CEP</Label>
              <Input id="zipCode" name="zipCode" placeholder="00000-000" required className="mt-1.5" />
              <FieldError errors={state.fieldErrors?.zipCode} />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input id="state" name="state" placeholder="PE" maxLength={2} required className="mt-1.5" />
              <FieldError errors={state.fieldErrors?.state} />
            </div>
          </div>

          <div>
            <Label htmlFor="street">Rua</Label>
            <Input id="street" name="street" required className="mt-1.5" />
            <FieldError errors={state.fieldErrors?.street} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="number">Número</Label>
              <Input id="number" name="number" required className="mt-1.5" />
              <FieldError errors={state.fieldErrors?.number} />
            </div>
            <div>
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" name="complement" className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" name="neighborhood" required className="mt-1.5" />
              <FieldError errors={state.fieldErrors?.neighborhood} />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" required className="mt-1.5" />
              <FieldError errors={state.fieldErrors?.city} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDefault" value="true" className="size-4 rounded border-input" />
            Definir como endereço principal
          </label>

          {state.status === "error" && state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar endereço
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
