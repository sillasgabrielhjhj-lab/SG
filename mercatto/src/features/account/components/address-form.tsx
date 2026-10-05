"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Checkbox } from "@/components/ui/checkbox";
import { UFS } from "@/lib/validators/br";
import { formatCep, formatPhone } from "@/lib/format";
import { createAddressAction, updateAddressAction } from "@/features/account/actions";

export type AddressFormValue = { id?: string; label?: string | null; recipientName: string; phone?: string | null; cep: string; street: string; number: string; complement?: string | null; district: string; city: string; state: string; reference?: string | null; isDefault?: boolean };

/** Formulário de endereço com preenchimento por CEP (ViaCEP) e fallback manual. */
export function AddressForm({ initial, defaultName, onSaved, onCancel, submitLabel = "Salvar endereço" }: { initial?: AddressFormValue; defaultName?: string; onSaved: (id: string) => void; onCancel?: () => void; submitLabel?: string }) {
  const [v, setV] = useState<AddressFormValue>(initial ?? { recipientName: defaultName ?? "", cep: "", street: "", number: "", district: "", city: "", state: "", isDefault: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "manual">(initial ? "found" : "idle");
  const [pending, start] = useTransition();
  const set = (k: keyof AddressFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const lookup = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepStatus("loading");
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (res.ok) {
        const d = (await res.json()) as { street: string; district: string; city: string; state: string };
        setV((p) => ({ ...p, street: d.street || p.street, district: d.district || p.district, city: d.city || p.city, state: d.state || p.state }));
        setCepStatus("found");
      } else {
        setCepStatus("manual");
        if (res.status === 404) setErrors((e) => ({ ...e, cep: ["CEP não encontrado — confira ou preencha manualmente."] }));
      }
    } catch {
      setCepStatus("manual");
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const payload = { ...v, phone: v.phone ?? "", complement: v.complement ?? "", label: v.label ?? "", reference: v.reference ?? "", isDefault: Boolean(v.isDefault) };
          const res = v.id ? await updateAddressAction({ ...payload, addressId: v.id }) : await createAddressAction(payload);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          onSaved(v.id ?? (res.data as { id: string }).id);
        });
      }}
      className="grid gap-3 sm:grid-cols-6"
    >
      <Field label="CEP" required error={errors.cep} className="sm:col-span-2" hint={cepStatus === "loading" ? "Buscando endereço…" : undefined}>
        <MaskedInput
          mask="cep"
          defaultValue={v.cep ? formatCep(v.cep) : ""}
          onChange={(e) => {
            setV((p) => ({ ...p, cep: e.target.value }));
            setErrors((er) => ({ ...er, cep: [] }));
            if (e.target.value.replace(/\D/g, "").length === 8) void lookup(e.target.value);
          }}
          placeholder="00000-000"
        />
      </Field>
      <div className="flex items-end sm:col-span-4">
        {cepStatus === "manual" ? <p className="pb-2 text-xs text-fg-muted">Não conseguimos completar automaticamente. Preencha os campos abaixo.</p> : null}
      </div>
      <Field label="Rua / Avenida" required error={errors.street} className="sm:col-span-4">
        <Input value={v.street} onChange={set("street")} autoComplete="address-line1" />
      </Field>
      <Field label="Número" required error={errors.number} className="sm:col-span-2" hint="Sem número? Use S/N">
        <Input value={v.number} onChange={set("number")} inputMode="text" />
      </Field>
      <Field label="Complemento" error={errors.complement} className="sm:col-span-3">
        <Input value={v.complement ?? ""} onChange={set("complement")} placeholder="Apto, bloco…" autoComplete="address-line2" />
      </Field>
      <Field label="Bairro" required error={errors.district} className="sm:col-span-3">
        <Input value={v.district} onChange={set("district")} />
      </Field>
      <Field label="Cidade" required error={errors.city} className="sm:col-span-4">
        <Input value={v.city} onChange={set("city")} autoComplete="address-level2" />
      </Field>
      <Field label="UF" required error={errors.state} className="sm:col-span-2">
        <Select value={v.state} onChange={set("state")}>
          <option value="">Selecione</option>
          {UFS.map((u) => (
            <option key={u.code} value={u.code}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nome de quem recebe" required error={errors.recipientName} className="sm:col-span-4">
        <Input value={v.recipientName} onChange={set("recipientName")} autoComplete="name" />
      </Field>
      <Field label="Telefone" error={errors.phone} className="sm:col-span-2">
        <MaskedInput mask="phone" defaultValue={v.phone ? formatPhone(v.phone) : ""} onChange={(e) => setV((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Ponto de referência" error={errors.reference} className="sm:col-span-4">
        <Input value={v.reference ?? ""} onChange={set("reference")} />
      </Field>
      <Field label="Apelido" error={errors.label} className="sm:col-span-2">
        <Input value={v.label ?? ""} onChange={set("label")} placeholder="Casa, Trabalho…" />
      </Field>
      <div className="sm:col-span-6">
        <Checkbox label="Usar como endereço principal" checked={Boolean(v.isDefault)} onChange={(e) => setV((p) => ({ ...p, isDefault: e.target.checked }))} />
      </div>
      {formError ? (
        <p role="alert" className="text-sm font-medium text-danger-700 sm:col-span-6">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-6">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
