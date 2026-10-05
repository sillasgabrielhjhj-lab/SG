"use client";

import { useEffect, useState } from "react";
import { Store, Truck } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { formatCep, formatShortDay } from "@/lib/format";
import { isValidCep } from "@/lib/validators/br";
import { Button } from "@/components/ui/button";
import { MaskedInput } from "@/components/ui/masked-input";
import { readSavedCep } from "@/components/layout/cep-selector";

type Option = { id: string; service: string; carrier: string | null; priceCents: number; originalPriceCents: number; minDays: number; maxDays: number; isPickup: boolean };

const addBusinessDays = (days: number) => {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
};

/** Simulação de frete por CEP para a variante/quantidade selecionadas. */
export function ShippingSimulator({ variantId, quantity }: { variantId: string | null; quantity: number }) {
  const [cep, setCep] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const quote = async (value = cep) => {
    const digits = value.replace(/\D/g, "");
    if (!isValidCep(digits)) return setError("Informe um CEP válido.");
    if (!variantId) return setError("Escolha as opções do produto para calcular o frete.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cep: digits, variantId, quantity }) });
      const data = (await res.json()) as { options?: Option[]; error?: string | null };
      if (!res.ok || data.error) {
        setOptions([]);
        setError(data.error ?? "Não foi possível calcular o frete.");
      } else setOptions(data.options ?? []);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = readSavedCep();
    if (saved?.cep && variantId) {
      setCep(formatCep(saved.cep));
      void quote(saved.cep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula ao trocar variante/quantidade
  }, [variantId, quantity]);

  return (
    <div className="rounded-card border border-line p-3.5">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Truck className="size-4 text-brand-700" aria-hidden /> Calcular frete e prazo
      </p>
      <form onSubmit={(e) => (e.preventDefault(), quote())} className="flex gap-2">
        <label htmlFor="cep-sim" className="sr-only">
          CEP
        </label>
        <MaskedInput id="cep-sim" mask="cep" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" loading={loading}>
          Calcular
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
      {options && options.length ? (
        <ul className="mt-3 flex flex-col gap-2" aria-live="polite">
          {options.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {o.isPickup ? <Store className="size-4 shrink-0 text-fg-subtle" aria-hidden /> : <Truck className="size-4 shrink-0 text-fg-subtle" aria-hidden />}
                <span className="min-w-0">
                  <span className="block font-medium">{o.service}</span>
                  <span className="block text-xs text-fg-muted">
                    {o.isPickup ? "Retire a partir de" : "Chega até"} {formatShortDay(addBusinessDays(o.maxDays))}
                  </span>
                </span>
              </span>
              <span className={o.priceCents === 0 ? "font-bold text-success-700" : "font-semibold tabular"}>{o.priceCents === 0 ? "Grátis" : formatBRL(o.priceCents)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
