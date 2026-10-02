"use client";

import { useActionState, useState } from "react";
import { Plus, Loader2 } from "lucide-react";

import { createCategoryAction } from "@/lib/actions/admin";
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

export function CategoryFormDialog({ topCategories }: { topCategories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await createCategoryAction(prevState, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" /> Nova categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required className="mt-1.5" />
            <FieldError errors={state.fieldErrors?.name} />
          </div>
          <div>
            <Label htmlFor="parentId">Categoria pai (opcional)</Label>
            <select
              id="parentId"
              name="parentId"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Nenhuma (categoria principal)</option>
              {topCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {state.status === "error" && state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Criar categoria
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
