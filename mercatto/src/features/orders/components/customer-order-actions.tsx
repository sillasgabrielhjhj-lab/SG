"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { customerCancelOrderAction } from "@/features/orders/actions";
import { RETURN_WINDOW_DAYS } from "@/features/orders/state-machine";

/** Cancelar compra pendente ou solicitar cancelamento/devolução (análise do vendedor). */
export function CustomerOrderActions({ number, canCancel, canRequestRefund, status }: { number: string; canCancel: boolean; canRequestRefund: boolean; status: OrderStatus }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  if (!canCancel && !canRequestRefund) return null;

  const isReturn = status === "DELIVERED";
  const label = canCancel ? "Cancelar compra" : isReturn ? "Devolver produto" : "Solicitar cancelamento";
  const description = canCancel
    ? "A reserva dos produtos será liberada e nenhuma cobrança será feita."
    : isReturn
      ? `Você tem até ${RETURN_WINDOW_DAYS} dias após o recebimento para desistir da compra (direito de arrependimento). O vendedor analisará a solicitação e o reembolso será feito na forma de pagamento original.`
      : "Como o pagamento já foi aprovado, o vendedor analisará a solicitação. Se aprovada, o valor é estornado na forma de pagamento original.";

  const submit = () =>
    start(async () => {
      const res = await customerCancelOrderAction({ number, reason });
      if (!res.ok) {
        setError(res.fieldErrors?.reason?.[0] ?? res.error);
        return;
      }
      toast.success(res.message ?? "Solicitação registrada.");
      setOpen(false);
      setReason("");
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" fullWidth onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={pending} onClick={submit}>
              Confirmar
            </Button>
          </>
        }
      >
        <Field label="Motivo" required error={error}>
          <Textarea value={reason} onChange={(e) => (setReason(e.target.value), setError(null))} maxLength={300} showCount rows={3} placeholder="Conte o que aconteceu" />
        </Field>
      </Modal>
    </>
  );
}
