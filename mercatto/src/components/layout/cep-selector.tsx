"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCep } from "@/lib/format";
import { isValidCep } from "@/lib/validators/br";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MaskedInput } from "@/components/ui/masked-input";
import { Modal } from "@/components/ui/modal";
import { useStorageValue } from "@/hooks/use-local-storage";

type SavedCep = { cep: string; city?: string; state?: string };
const KEY = "mrc_cep";

export function readSavedCep(): SavedCep | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedCep) : null;
  } catch {
    return null;
  }
}

/** Seletor de CEP de entrega (persistido no navegador e em cookie para o cálculo de frete). */
export function CepSelector({ className, tone = "inverse" }: { className?: string; tone?: "inverse" | "default" }) {
  const savedRaw = useStorageValue(KEY);
  const saved = useMemo<SavedCep | null>(() => {
    if (!savedRaw) return null;
    try {
      return JSON.parse(savedRaw) as SavedCep;
    } catch {
      return null;
    }
  }, [savedRaw]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const digits = value.replace(/\D/g, "");
    if (!isValidCep(digits)) return setError("Digite um CEP válido com 8 números.");
    setLoading(true);
    setError(null);
    let entry: SavedCep = { cep: digits };
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (res.status === 404) {
        setLoading(false);
        return setError("CEP não encontrado. Confira o número.");
      }
      if (res.ok) {
        const data = (await res.json()) as { city?: string; state?: string };
        entry = { cep: digits, city: data.city, state: data.state };
      }
    } catch {
      /* serviço indisponível: salva só o CEP */
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(entry));
    } catch {
      /* ignora */
    }
    document.cookie = `mrc_cep=${digits}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event("mrc:cep"));
    setLoading(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (setValue(saved?.cep ? formatCep(saved.cep) : ""), setOpen(true))}
        className={cn("flex min-w-0 items-center gap-1.5 rounded-md py-1 text-left focus-ring", tone === "inverse" ? "text-white/90 hover:text-white" : "text-fg-muted hover:text-fg", className)}
      >
        <MapPin className="size-4 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-2xs opacity-80">{saved ? "Enviar para" : "Informe seu CEP"}</span>
          <span className="truncate text-xs font-semibold">{saved ? `${formatCep(saved.cep)}${saved.city ? ` · ${saved.city}` : ""}` : "Calcule prazos e fretes"}</span>
        </span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Onde você quer receber?"
        description="Usamos o CEP para mostrar prazos e valores de frete. Ele fica salvo apenas neste navegador."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={loading}>
              Usar este CEP
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => (e.preventDefault(), save())}>
          <Field label="CEP" error={error}>
            <MaskedInput mask="cep" value={value} onChange={(e) => setValue(e.target.value)} placeholder="00000-000" autoFocus />
          </Field>
          <a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
            Não sei meu CEP
          </a>
        </form>
      </Modal>
    </>
  );
}
