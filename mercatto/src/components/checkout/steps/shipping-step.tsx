import { Truck, ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";
import type { ShippingOption } from "@/lib/shipping";

export function ShippingStep({
  options,
  selectedId,
  onSelect,
  onBack,
  onContinue,
}: {
  options: ShippingOption[];
  selectedId: string;
  onSelect: (id: "standard" | "express") => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Como você quer receber?</h2>

      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 transition-colors ${
              selectedId === option.id ? "border-primary bg-secondary/50" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="checkout-shipping"
                checked={selectedId === option.id}
                onChange={() => onSelect(option.id)}
                className="size-4"
              />
              <Truck className="size-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-muted-foreground">Chega em até {option.days} dias úteis</p>
              </div>
            </div>
            <p className="font-medium text-foreground">
              {option.costCents === 0 ? "Grátis" : formatCurrencyBRL(option.costCents)}
            </p>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button onClick={onContinue}>
          Continuar <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
