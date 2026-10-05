"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCep } from "@/lib/format";
import { deleteAddressAction, setDefaultAddressAction } from "@/features/account/actions";
import { AddressForm, type AddressFormValue } from "@/features/account/components/address-form";

type AddressRow = AddressFormValue & { id: string; isDefault: boolean };

export function AddressBook({ addresses, defaultName }: { addresses: AddressRow[]; defaultName: string }) {
  const [editing, setEditing] = useState<AddressRow | "new" | null>(null);
  const [removing, setRemoving] = useState<AddressRow | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        router.refresh();
      } else toast.error(res.error ?? "Não foi possível concluir.");
    });

  return (
    <>
      {addresses.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<MapPin />} title="Nenhum endereço cadastrado" description="Cadastre um endereço para calcular o frete e finalizar compras mais rápido." action={<Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" />}>Adicionar endereço</Button>} />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <MapPin className="size-4 text-brand-700" aria-hidden />
                  {a.label || "Endereço"}
                </p>
                {a.isDefault ? <Badge tone="brand">Padrão</Badge> : null}
              </div>
              <div className="text-sm">
                <p className="font-semibold">{a.recipientName}</p>
                <p className="text-fg-muted">
                  {a.street}, {a.number}
                  {a.complement ? ` — ${a.complement}` : ""}
                </p>
                <p className="text-fg-muted">
                  {a.district} · {a.city}/{a.state}
                </p>
                <p className="text-fg-muted">CEP {formatCep(a.cep)}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="outline" leftIcon={<Pencil className="size-4" />} onClick={() => setEditing(a)}>
                  Editar
                </Button>
                {!a.isDefault ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultAddressAction({ addressId: a.id }))}>
                    Tornar padrão
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="ml-auto text-danger-700 hover:bg-danger-50" leftIcon={<Trash2 className="size-4" />} onClick={() => setRemoving(a)}>
                  Excluir
                </Button>
              </div>
            </li>
          ))}
          {addresses.length < 10 ? (
            <li>
              <button type="button" onClick={() => setEditing("new")} className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 focus-ring">
                <Plus className="size-6" aria-hidden /> Adicionar endereço
              </button>
            </li>
          ) : null}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo endereço" : "Editar endereço"} size="lg">
        {editing ? (
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            defaultName={defaultName}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast.success("Endereço salvo.");
              setEditing(null);
              router.refresh();
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Excluir endereço?"
        description={removing ? `${removing.street}, ${removing.number} — ${removing.city}/${removing.state}` : undefined}
        confirmLabel="Excluir"
        loading={pending}
        onConfirm={() => {
          const target = removing;
          if (!target) return;
          run(async () => {
            const res = await deleteAddressAction({ addressId: target.id });
            if (res.ok) setRemoving(null);
            return res;
          });
        }}
      />
    </>
  );
}
