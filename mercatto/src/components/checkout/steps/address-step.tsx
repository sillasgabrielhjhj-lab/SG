import { MapPin, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddressFormDialog } from "@/app/minha-conta/enderecos/address-form-dialog";
import type { CheckoutAddress } from "@/components/checkout/checkout-wizard";

export function AddressStep({
  addresses,
  selectedId,
  onSelect,
  onCreated,
  onContinue,
}: {
  addresses: CheckoutAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Para onde enviamos seu pedido?
        </h2>
        <AddressFormDialog onCreated={onCreated} />
      </div>

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem endereços cadastrados. Adicione um para continuar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                selectedId === address.id ? "border-primary bg-secondary/50" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="checkout-address"
                checked={selectedId === address.id}
                onChange={() => onSelect(address.id)}
                className="mt-1 size-4"
              />
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{address.label || "Endereço"} — {address.recipientName}</p>
                <p className="text-muted-foreground">
                  {address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ""} · {address.neighborhood},{" "}
                  {address.city} - {address.state} · CEP {address.zipCode}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      <Button size="lg" disabled={!selectedId} onClick={onContinue} className="w-fit">
        Continuar <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
