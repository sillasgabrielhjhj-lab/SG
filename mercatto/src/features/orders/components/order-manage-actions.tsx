"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/masked-input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { formatBRL } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/features/orders/state-machine";
import { adminRefundOrderAction, adminUpdateOrderAction, sellerUpdateOrderAction } from "@/features/orders/actions";

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "Iniciar preparação",
  SHIPPED: "Marcar como enviado",
  IN_TRANSIT: "Em trânsito",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Confirmar entrega",
  CANCELLED: "Cancelar pedido",
  REFUNDED: "Aprovar reembolso",
};

/**
 * Ações de gestão do pedido (vendedor/admin). As transições disponíveis vêm
 * da máquina de estados no servidor; o servidor revalida tudo.
 */
export function OrderManageActions({ mode, orderId, status, transitions, refundableCents, previousStatus }: { mode: "seller" | "admin"; orderId: string; status: OrderStatus; transitions: OrderStatus[]; refundableCents: number; previousStatus: OrderStatus | null }) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [form, setForm] = useState({ trackingCode: "", carrier: "", trackingUrl: "", note: "" });
  const [refund, setRefund] = useState<{ amountCents: number | null; reason: string; restock: boolean }>({ amountCents: refundableCents, reason: "", restock: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Recusa de reembolso: volta ao status anterior (único destino válido).
  const rejectTarget = status === "REFUND_REQUESTED" && previousStatus && transitions.includes(previousStatus) ? previousStatus : null;
  const forward = transitions.filter((t) => t !== rejectTarget);

  const submit = () =>
    start(async () => {
      if (!target) return;
      const action = mode === "seller" ? sellerUpdateOrderAction : adminUpdateOrderAction;
      const res = await action({ orderId, to: target, ...form });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Pedido atualizado.");
      setTarget(null);
      setErrors({});
      router.refresh();
    });

  const submitRefund = () =>
    start(async () => {
      const res = await adminRefundOrderAction({ orderId, amountCents: refund.amountCents ?? undefined, reason: refund.reason, restock: refund.restock });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Reembolso registrado.");
      setRefundOpen(false);
      router.refresh();
    });

  if (!forward.length && !rejectTarget && !(mode === "admin" && refundableCents > 0)) {
    return <p className="text-sm text-fg-muted">Nenhuma ação disponível para este status.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {forward.map((t) => (
        <Button key={t} variant={t === "CANCELLED" ? "outline" : "primary"} className={t === "CANCELLED" ? "text-danger-700" : undefined} fullWidth onClick={() => (setTarget(t), setErrors({}))}>
          {ACTION_LABEL[t] ?? ORDER_STATUS_LABELS[t]}
        </Button>
      ))}
      {rejectTarget ? (
        <Button variant="outline" fullWidth onClick={() => setTarget(rejectTarget)}>
          Recusar solicitação
        </Button>
      ) : null}
      {mode === "admin" && refundableCents > 0 && status !== "REFUND_REQUESTED" ? (
        <Button variant="ghost" fullWidth onClick={() => setRefundOpen(true)}>
          Reembolso manual (parcial ou total)
        </Button>
      ) : null}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? (target === rejectTarget ? "Recusar solicitação de cancelamento/devolução" : (ACTION_LABEL[target] ?? ORDER_STATUS_LABELS[target])) : ""}
        description={target === "CANCELLED" ? "O estoque volta para a loja e o valor pago é estornado automaticamente ao cliente." : target === "REFUNDED" ? "O valor do pedido é estornado na forma de pagamento original." : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Voltar
            </Button>
            <Button variant={target === "CANCELLED" ? "danger" : "primary"} loading={pending} onClick={submit}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {target === "SHIPPED" ? (
            <>
              <Field label="Código de rastreio" required error={errors.trackingCode}>
                <Input value={form.trackingCode} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, trackingCode: e.target.value.toUpperCase() }))} className="font-mono uppercase" />
              </Field>
              <Field label="Transportadora" error={errors.carrier}>
                <Input value={form.carrier} maxLength={60} placeholder="Ex.: Correios, Jadlog" onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} />
              </Field>
              <Field label="Link de rastreio" error={errors.trackingUrl} hint="Opcional (https://…)">
                <Input type="url" value={form.trackingUrl} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, trackingUrl: e.target.value }))} />
              </Field>
            </>
          ) : null}
          <Field label={target === "CANCELLED" || target === rejectTarget ? "Motivo (enviado ao cliente)" : "Observação"} error={errors.note} required={target === "CANCELLED"}>
            <Textarea value={form.note} maxLength={300} rows={2} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Reembolso manual"
        description={`Disponível para reembolso: ${formatBRL(refundableCents)}. O estorno é enviado ao gateway e registrado na auditoria.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={pending} onClick={submitRefund}>
              Reembolsar
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Valor" error={errors.amountCents}>
            <PriceInput defaultCents={refund.amountCents} onCentsChange={(c) => setRefund((r) => ({ ...r, amountCents: c }))} />
          </Field>
          <Field label="Motivo" required error={errors.reason}>
            <Textarea value={refund.reason} maxLength={300} rows={2} onChange={(e) => setRefund((r) => ({ ...r, reason: e.target.value }))} />
          </Field>
          <Checkbox checked={refund.restock} onChange={(e) => setRefund((r) => ({ ...r, restock: e.target.checked }))} label="Devolver itens ao estoque" description="Marque se os produtos retornaram e podem ser vendidos novamente." />
        </div>
      </Modal>
    </div>
  );
}
