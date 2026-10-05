"use client";

import { useEffect, useMemo, useState } from "react";
import { Store, Truck } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { formatCep, formatShortDay } from "@/lib/format";
import { isValidCep } from "@/lib/validators/br";
import { Button } from "@/components/ui/button";
import { MaskedInput } from "@/components/ui/masked-input";
import { useStorageValue } from "@/hooks/use-local-storage";

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
  // CEP salvo no seletor do cabeçalho (localStorage "mrc_cep") pré-preenche e cota automaticamente.
  const savedRaw = useStorageValue("mrc_cep");
  const savedCep = useMemo(() => {
    try {
      return savedRaw ? ((JSON.parse(savedRaw) as { cep?: string }).cep ?? null) : null;
    } catch {
      return null;
    }
  }, [savedRaw]);
  const [typedCep, setCep] = useState<string | null>(null);
  const cep = typedCep ?? (savedCep ? formatCep(savedCep) : "");
  // CEP efetivamente cotado: o enviado pelo usuário ou, até lá, o salvo no cabeçalho.
  const [submittedCep, setSubmittedCep] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // novo envio do mesmo CEP refaz a cotação
  const [response, setResponse] = useState<{ key: string; options: Option[]; error: string | null } | null>(null);

  const activeCep = submittedCep ?? savedCep;
  const requestKey = activeCep && variantId ? `${activeCep}|${variantId}|${quantity}|${attempt}` : null;
  const current = response && response.key === requestKey ? response : null;
  const loading = requestKey !== null && current === null;
  const options = current?.options ?? null;
  const error = inputError ?? current?.error ?? null;

  // Busca a cotação sempre que o CEP, a variação ou a quantidade mudam (estado só é gravado na resposta).
  useEffect(() => {
    if (!requestKey || !activeCep || !variantId) return;
    const controller = new AbortController();
    fetch("/api/shipping/quote", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ cep: activeCep, variantId, quantity }) })
      .then(async (res) => {
        const data = (await res.json()) as { options?: Option[]; error?: string | null };
        if (!res.ok || data.error) setResponse({ key: requestKey, options: [], error: data.error ?? "Não foi possível calcular o frete." });
        else setResponse({ key: requestKey, options: data.options ?? [], error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResponse({ key: requestKey, options: [], error: "Falha de conexão. Tente novamente." });
      });
    return () => controller.abort();
  }, [requestKey, activeCep, variantId, quantity]);

  const quote = () => {
    const digits = cep.replace(/\D/g, "");
    if (!isValidCep(digits)) return setInputError("Informe um CEP válido.");
    if (!variantId) return setInputError("Escolha as opções do produto para calcular o frete.");
    setInputError(null);
    setSubmittedCep(digits);
    setAttempt((n) => n + 1);
  };

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
