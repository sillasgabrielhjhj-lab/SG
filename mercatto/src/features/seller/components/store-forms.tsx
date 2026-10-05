"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MaskedInput, PriceInput } from "@/components/ui/masked-input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { UFS } from "@/lib/validators/br";
import { formatCep, formatCnpj, formatCpf, formatPhone } from "@/lib/format";
import { createStoreAction, replaceShippingRulesAction, updateStoreProfileAction } from "@/features/seller/actions";

type StoreValues = { name: string; description: string; document: string; contactEmail: string; contactPhone: string; originCep: string; originCity: string; originState: string };

const formatDoc = (d: string) => (d.replace(/\D/g, "").length > 11 ? formatCnpj(d) : formatCpf(d));

export function StoreProfileForm({ mode, initial }: { mode: "create" | "edit"; initial?: Partial<StoreValues> }) {
  const [v, setV] = useState<StoreValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    document: initial?.document ? formatDoc(initial.document) : "",
    contactEmail: initial?.contactEmail ?? "",
    contactPhone: initial?.contactPhone ? formatPhone(initial.contactPhone) : "",
    originCep: initial?.originCep ? formatCep(initial.originCep) : "",
    originCity: initial?.originCity ?? "",
    originState: initial?.originState ?? "",
  });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = (k: keyof StoreValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const res = await fetch(`/api/cep/${digits}`).catch(() => null);
    if (res?.ok) {
      const d = (await res.json()) as { city: string; state: string };
      setV((p) => ({ ...p, originCity: d.city || p.originCity, originState: d.state || p.originState }));
    }
  };

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = mode === "create" ? await createStoreAction({ ...v, acceptSellerTerms: accept }) : await updateStoreProfileAction(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
            return;
          }
          setErrors({});
          toast.success(res.message ?? "Salvo.");
          if (mode === "create") router.push("/vendedor");
          else router.refresh();
        });
      }}
    >
      <Field label="Nome da loja" required error={errors.name} className="sm:col-span-2" hint="É assim que os clientes verão sua loja.">
        <Input value={v.name} onChange={set("name")} maxLength={60} />
      </Field>
      <Field label="CPF ou CNPJ" required error={errors.document} hint={mode === "edit" ? "Para alterar, fale com o suporte." : "Usado para repasses e emissão de notas."}>
        <Input value={v.document} onChange={(e) => setV((p) => ({ ...p, document: formatDoc(e.target.value) }))} inputMode="numeric" maxLength={18} readOnly={mode === "edit"} disabled={mode === "edit"} />
      </Field>
      <Field label="Telefone de contato" error={errors.contactPhone}>
        <MaskedInput mask="phone" value={v.contactPhone} onChange={set("contactPhone")} inputMode="tel" />
      </Field>
      <Field label="E-mail de atendimento" error={errors.contactEmail} className="sm:col-span-2">
        <Input type="email" value={v.contactEmail} onChange={set("contactEmail")} autoComplete="email" />
      </Field>
      <Field label="CEP de origem dos envios" required error={errors.originCep}>
        <MaskedInput mask="cep" value={v.originCep} onChange={(e) => (set("originCep")(e), void lookupCep(e.target.value))} inputMode="numeric" />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-3">
        <Field label="Cidade" error={errors.originCity}>
          <Input value={v.originCity} onChange={set("originCity")} maxLength={100} />
        </Field>
        <Field label="UF" error={errors.originState}>
          <Select value={v.originState} onChange={set("originState")}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf.code} value={uf.code}>
                {uf.code}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Sobre a loja" error={errors.description} className="sm:col-span-2" hint="Conte o que você vende e seus diferenciais.">
        <Textarea value={v.description} onChange={set("description")} maxLength={1000} showCount rows={4} />
      </Field>
      {mode === "create" ? (
        <div className="sm:col-span-2">
          <Checkbox
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            label={
              <>
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" className="font-semibold text-brand-700 underline">
                  termos para vendedores
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">
                  política de privacidade
                </Link>
              </>
            }
          />
          {errors.acceptSellerTerms ? <p className="mt-1 text-xs text-danger-700">{errors.acceptSellerTerms[0]}</p> : null}
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending} size={mode === "create" ? "lg" : "md"}>
          {mode === "create" ? "Criar minha loja" : "Salvar dados da loja"}
        </Button>
      </div>
    </form>
  );
}

type Rule = { name: string; regionCode: string; maxWeightGrams: string; priceCents: number | null; additionalKgCents: number | null; minDays: string; maxDays: string; isActive: boolean; key: string };

const REGIONS = [
  { value: "SAME_STATE", label: "Mesmo estado" },
  { value: "SAME_REGION", label: "Mesma região" },
  { value: "OTHER", label: "Demais regiões" },
  { value: "PICKUP", label: "Retirada na loja" },
  ...UFS.map((uf) => ({ value: uf.code, label: uf.name })),
];

let ruleSeq = 0;
const newKey = () => `r${++ruleSeq}`;

export function ShippingRulesEditor({ initial }: { initial: { name: string; regionCode: string; maxWeightGrams: number; priceCents: number; additionalKgCents: number; minDays: number; maxDays: number; isActive: boolean }[] }) {
  const [rules, setRules] = useState<Rule[]>(() => initial.map((r) => ({ ...r, maxWeightGrams: String(r.maxWeightGrams), minDays: String(r.minDays), maxDays: String(r.maxDays), key: newKey() })));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const update = (i: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? <p className="rounded-md bg-surface-muted p-3 text-sm text-fg-muted">Sem regras próprias: usamos a tabela padrão da Mercatto para calcular o frete dos seus produtos.</p> : null}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {rules.length ? (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs font-semibold text-fg-muted">
              <tr>
                <th className="py-2 pr-2">Modalidade</th>
                <th className="py-2 pr-2">Destino</th>
                <th className="py-2 pr-2">Peso até (g)</th>
                <th className="py-2 pr-2">Preço</th>
                <th className="py-2 pr-2">Kg adicional</th>
                <th className="py-2 pr-2">Prazo (dias)</th>
                <th className="py-2 pr-2">Ativa</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rules.map((r, i) => {
                const e = (f: string) => errors[`rules.${i}.${f}`]?.[0];
                return (
                  <tr key={r.key} className="align-top">
                    <td className="py-2 pr-2">
                      <Input value={r.name} onChange={(ev) => update(i, { name: ev.target.value })} aria-label="Modalidade" placeholder="Padrão" className="h-10 w-32" maxLength={40} />
                      {e("name") ? <p className="mt-1 text-2xs text-danger-700">{e("name")}</p> : null}
                    </td>
                    <td className="py-2 pr-2">
                      <Select value={r.regionCode} onChange={(ev) => update(i, { regionCode: ev.target.value })} aria-label="Destino" className="h-10 w-40">
                        {REGIONS.map((reg) => (
                          <option key={reg.value} value={reg.value}>
                            {reg.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" min={1} value={r.maxWeightGrams} onChange={(ev) => update(i, { maxWeightGrams: ev.target.value })} aria-label="Peso máximo em gramas" className="h-10 w-24" />
                    </td>
                    <td className="py-2 pr-2">
                      <PriceInput defaultCents={r.priceCents} onCentsChange={(c) => update(i, { priceCents: c })} aria-label="Preço" className="h-10 w-28" />
                    </td>
                    <td className="py-2 pr-2">
                      <PriceInput defaultCents={r.additionalKgCents} onCentsChange={(c) => update(i, { additionalKgCents: c })} aria-label="Preço por kg adicional" className="h-10 w-28" />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} value={r.minDays} onChange={(ev) => update(i, { minDays: ev.target.value })} aria-label="Prazo mínimo" className="h-10 w-16" />
                        <span className="text-fg-subtle">a</span>
                        <Input type="number" min={0} value={r.maxDays} onChange={(ev) => update(i, { maxDays: ev.target.value })} aria-label="Prazo máximo" className="h-10 w-16" />
                      </div>
                      {e("maxDays") ? <p className="mt-1 text-2xs text-danger-700">{e("maxDays")}</p> : null}
                    </td>
                    <td className="py-2 pt-4 pr-2">
                      <input type="checkbox" className="size-5 accent-brand-700" checked={r.isActive} onChange={(ev) => update(i, { isActive: ev.target.checked })} aria-label="Regra ativa" />
                    </td>
                    <td className="py-2">
                      <Button type="button" variant="ghost" size="icon" aria-label="Remover regra" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setRules((rs) => [...rs, { name: "Padrão", regionCode: "SAME_STATE", maxWeightGrams: "1000", priceCents: 1990, additionalKgCents: 300, minDays: "2", maxDays: "5", isActive: true, key: newKey() }])}>
          Adicionar regra
        </Button>
        <Button
          type="button"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await replaceShippingRulesAction({
                rules: rules.map((r) => ({ name: r.name, regionCode: r.regionCode, maxWeightGrams: Number(r.maxWeightGrams), priceCents: r.priceCents ?? 0, additionalKgCents: r.additionalKgCents ?? 0, minDays: Number(r.minDays), maxDays: Number(r.maxDays), isActive: r.isActive })),
              });
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                toast.error(res.error);
                return;
              }
              setErrors({});
              toast.success(res.message ?? "Tabela salva.");
              router.refresh();
            })
          }
        >
          Salvar tabela de frete
        </Button>
      </div>
      <p className="text-xs text-fg-muted">Para cada destino, usamos a regra ativa de menor peso que comporte o pacote (peso real ou cúbico, o maior). Acima do limite, cobra-se o kg adicional.</p>
    </div>
  );
}
