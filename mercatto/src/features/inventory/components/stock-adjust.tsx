"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { adminAdjustStockAction, adminSetMinStockAction, sellerAdjustStockAction, sellerSetMinStockAction } from "@/features/inventory/actions";

const TYPES = [
  { value: "IN", label: "Entrada (compra/reposição)" },
  { value: "OUT", label: "Saída (perda, avaria, uso interno)" },
  { value: "RETURN", label: "Devolução de cliente" },
  { value: "ADJUSTMENT", label: "Ajuste de inventário" },
] as const;

/** Botão + modal de movimentação manual de estoque de uma variação. */
export function StockAdjustButton({ mode, variant }: { mode: "seller" | "admin"; variant: { id: string; label: string; stock: number; minStock: number } }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("IN");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [minStock, setMinStock] = useState(String(variant.minStock));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const qty = Number(quantity) || 0;
  const delta = type === "OUT" || (type === "ADJUSTMENT" && direction === "down") ? -qty : qty;
  const after = variant.stock + delta;

  const submit = () =>
    start(async () => {
      const adjust = mode === "seller" ? sellerAdjustStockAction : adminAdjustStockAction;
      const setMin = mode === "seller" ? sellerSetMinStockAction : adminSetMinStockAction;
      if (Number(minStock) !== variant.minStock) {
        const r = await setMin({ variantId: variant.id, minStock: Number(minStock) || 0 });
        if (!r.ok) return void toast.error(r.error);
      }
      if (qty > 0) {
        const res = await adjust({ variantId: variant.id, type, quantity: qty, direction, reason });
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Estoque atualizado.");
      } else toast.success("Estoque mínimo atualizado.");
      setOpen(false);
      setReason("");
      setQuantity("1");
      router.refresh();
    });

  return (
    <>
      <Button size="sm" variant="outline" leftIcon={<SlidersHorizontal className="size-4" />} onClick={() => setOpen(true)}>
        Movimentar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Movimentar estoque"
        description={variant.label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={pending} disabled={after < 0}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de movimentação" className="sm:col-span-2">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          {type === "ADJUSTMENT" ? (
            <Field label="Direção" className="sm:col-span-2">
              <Select value={direction} onChange={(e) => setDirection(e.target.value as "up" | "down")}>
                <option value="up">Aumentar saldo</option>
                <option value="down">Diminuir saldo</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Quantidade" required error={errors.quantity}>
            <Input type="number" min={0} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Estoque mínimo (alerta)">
            <Input type="number" min={0} inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </Field>
          <Field label="Motivo" required error={errors.reason} className="sm:col-span-2" hint="Fica registrado no histórico e na auditoria.">
            <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: NF 1234 do fornecedor" />
          </Field>
          <p className="rounded-md bg-surface-muted p-3 text-sm sm:col-span-2">
            Saldo atual <strong className="tabular">{variant.stock}</strong> → após a movimentação <strong className={after < 0 ? "text-danger-700 tabular" : "tabular"}>{after}</strong>
            {after < 0 ? <span className="block text-xs text-danger-700">O estoque não pode ficar negativo.</span> : null}
          </p>
        </div>
      </Modal>
    </>
  );
}
