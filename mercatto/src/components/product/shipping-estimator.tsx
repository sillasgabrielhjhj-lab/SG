"use client";

import { useState, type FormEvent } from "react";
import { Truck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";

/** Estimativa ilustrativa de frete/prazo a partir do CEP — não há
 * integração real com transportadora. O valor/prazo é só para dar uma
 * sensação de uso; nada aqui deve ser lido como garantia de entrega. */
function estimateFromZip(zip: string) {
  const digits = zip.replace(/\D/g, "");
  let hash = 0;
  for (const char of digits) hash = (hash * 31 + Number(char)) >>> 0;

  const days = 2 + (hash % 6);
  const isFree = hash % 4 === 0;
  const costCents = isFree ? 0 : 990 + (hash % 25) * 100;

  return { days, costCents, isFree };
}

export function ShippingEstimator() {
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<ReturnType<typeof estimateFromZip> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) {
      setError("Informe um CEP válido (8 dígitos)");
      setResult(null);
      return;
    }
    setError(null);
    setResult(estimateFromZip(zip));
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Truck className="size-4" /> Calcular frete e prazo
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="00000-000"
          aria-label="CEP"
          className="h-9 max-w-40"
        />
        <Button type="submit" size="sm" variant="outline">
          Calcular
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-foreground">
          {result.isFree ? (
            <span className="font-medium text-success">Frete grátis</span>
          ) : (
            <span className="font-medium">{formatCurrencyBRL(result.costCents)}</span>
          )}{" "}
          — chega em até {result.days} dias úteis
        </p>
      )}
    </div>
  );
}
