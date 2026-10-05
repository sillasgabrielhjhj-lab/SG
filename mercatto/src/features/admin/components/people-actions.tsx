"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { changeStoreStatusAction, changeUserRoleAction, changeUserStatusAction } from "@/features/admin/actions";
import { moderateReviewAction } from "@/features/reviews/actions";
import { moderateQuestionAction } from "@/features/questions/actions";
import { useAdminAction } from "@/features/admin/components/use-admin-action";

type Role = "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORT";
const ROLES: Record<Role, string> = { CUSTOMER: "Cliente", SELLER: "Vendedor", ADMIN: "Administrador", SUPPORT: "Suporte" };

/** Suspender / reativar conta (sessões são revogadas ao suspender). */
export function UserStatusButton({ userId, name, status, disabled }: { userId: string; name: string; status: "ACTIVE" | "SUSPENDED"; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAdminAction();
  const suspending = status === "ACTIVE";
  return (
    <>
      <Button size="sm" variant={suspending ? "ghost" : "outline"} className={suspending ? "text-danger-700" : undefined} leftIcon={suspending ? <Ban className="size-4" /> : <RotateCcw className="size-4" />} disabled={disabled} onClick={() => setOpen(true)}>
        {suspending ? "Suspender" : "Reativar"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        tone={suspending ? "danger" : "primary"}
        title={suspending ? `Suspender ${name}?` : `Reativar ${name}?`}
        description={suspending ? "A pessoa perde o acesso imediatamente (todas as sessões são encerradas). Pedidos existentes são mantidos." : "A conta volta a poder entrar e comprar."}
        confirmLabel={suspending ? "Suspender" : "Reativar"}
        loading={pending}
        onConfirm={() => run(() => changeUserStatusAction({ userId, status: suspending ? "SUSPENDED" : "ACTIVE" }), () => setOpen(false))}
      />
    </>
  );
}

/** Troca de papel com confirmação (o servidor impede alterar o próprio papel e remover o último admin). */
export function UserRoleSelect({ userId, name, role, disabled }: { userId: string; name: string; role: Role; disabled?: boolean }) {
  const [next, setNext] = useState<Role | null>(null);
  const { pending, run } = useAdminAction();
  return (
    <>
      <Select aria-label={`Papel de ${name}`} value={role} disabled={disabled || pending} className="h-9 w-40 text-sm" onChange={(e) => setNext(e.target.value as Role)}>
        {Object.entries(ROLES).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      <ConfirmDialog
        open={next !== null}
        onClose={() => setNext(null)}
        tone={next === "ADMIN" ? "danger" : "primary"}
        title={`Alterar o papel de ${name}?`}
        description={next ? `${ROLES[role]} → ${ROLES[next]}. As sessões da pessoa serão encerradas para aplicar as novas permissões.${next === "ADMIN" ? " Administradores têm acesso total à plataforma." : ""}` : undefined}
        requireText={next === "ADMIN" ? "ADMIN" : undefined}
        confirmLabel="Alterar papel"
        loading={pending}
        onConfirm={() => {
          const r = next;
          if (r) run(() => changeUserRoleAction({ userId, role: r }), () => setNext(null));
        }}
      />
    </>
  );
}

/** Aprovação / suspensão de lojas parceiras. */
export function StoreStatusActions({ storeId, name, status, isOfficial }: { storeId: string; name: string; status: "PENDING" | "ACTIVE" | "SUSPENDED"; isOfficial: boolean }) {
  const [target, setTarget] = useState<"PENDING" | "ACTIVE" | "SUSPENDED" | null>(null);
  const [note, setNote] = useState("");
  const { pending, run, err } = useAdminAction();
  if (isOfficial) return <span className="text-xs text-fg-muted">Loja oficial</span>;
  const labels = { ACTIVE: status === "SUSPENDED" ? "Reativar" : "Aprovar", SUSPENDED: "Suspender", PENDING: "Voltar para análise" } as const;
  const options = (["ACTIVE", "SUSPENDED", "PENDING"] as const).filter((s) => s !== status);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((s) => (
        <Button key={s} size="sm" variant={s === "ACTIVE" ? "primary" : s === "SUSPENDED" ? "ghost" : "outline"} className={s === "SUSPENDED" ? "text-danger-700" : undefined} leftIcon={s === "ACTIVE" ? <CheckCircle2 className="size-4" /> : s === "SUSPENDED" ? <Ban className="size-4" /> : <Clock className="size-4" />} onClick={() => (setTarget(s), setNote(""))}>
          {labels[s]}
        </Button>
      ))}
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        tone={target === "SUSPENDED" ? "danger" : "primary"}
        title={target ? `${labels[target]} a loja "${name}"?` : ""}
        description={target === "SUSPENDED" ? "Os anúncios ativos serão pausados e o vendedor será notificado." : target === "ACTIVE" ? "O vendedor poderá publicar anúncios e será notificado." : "A loja volta para análise."}
        confirmLabel={target ? labels[target] : "Confirmar"}
        loading={pending}
        onConfirm={() => {
          const t = target;
          if (!t) return;
          run(() => changeStoreStatusAction({ storeId, status: t, note }), () => setTarget(null));
        }}
      >
        <Field label={target === "SUSPENDED" ? "Motivo (enviado ao vendedor)" : "Observação (opcional)"} error={err("note")}>
          <Textarea value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

/** Moderação de avaliação. */
export function ReviewModeration({ reviewId, status }: { reviewId: string; status: "PENDING" | "PUBLISHED" | "REJECTED" }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const { pending, run } = useAdminAction();
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "PUBLISHED" ? (
        <Button size="sm" leftIcon={<CheckCircle2 className="size-4" />} loading={pending && !rejecting} onClick={() => run(() => moderateReviewAction({ reviewId, status: "PUBLISHED" }))}>
          Publicar
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button size="sm" variant="ghost" className="text-danger-700" leftIcon={<XCircle className="size-4" />} onClick={() => setRejecting(true)}>
          Rejeitar
        </Button>
      ) : null}
      {status !== "PENDING" ? (
        <Button size="sm" variant="ghost" onClick={() => run(() => moderateReviewAction({ reviewId, status: "PENDING" }))} disabled={pending}>
          Voltar para pendente
        </Button>
      ) : null}
      <ConfirmDialog open={rejecting} onClose={() => setRejecting(false)} title="Rejeitar avaliação?" description="A avaliação deixa de aparecer na loja e sai da média do produto." confirmLabel="Rejeitar" loading={pending} onConfirm={() => run(() => moderateReviewAction({ reviewId, status: "REJECTED", note }), () => setRejecting(false))}>
        <Field label="Motivo interno (opcional)">
          <Textarea value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

/** Moderação de pergunta. */
export function QuestionModeration({ questionId, status }: { questionId: string; status: "PENDING" | "PUBLISHED" | "REJECTED" }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "PUBLISHED" ? (
        <Button size="sm" leftIcon={<CheckCircle2 className="size-4" />} disabled={pending} onClick={() => run(() => moderateQuestionAction({ questionId, status: "PUBLISHED" }))}>
          Publicar
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button size="sm" variant="ghost" className="text-danger-700" leftIcon={<XCircle className="size-4" />} disabled={pending} onClick={() => run(() => moderateQuestionAction({ questionId, status: "REJECTED" }))}>
          Rejeitar
        </Button>
      ) : null}
    </div>
  );
}
