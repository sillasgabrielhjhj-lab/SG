"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, QrCode, RefreshCw, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Countdown } from "@/components/ui/countdown";
import { useToast } from "@/components/ui/toast";
import { cancelPendingCheckoutAction, getCheckoutStatusAction, retryPaymentAction } from "@/features/checkout/actions";
import { CardTokenizer, type CardTokenResult } from "@/features/checkout/components/card-tokenizer";

type Payment = { id: string; status: string; method: "PIX" | "CREDIT_CARD"; amountCents: number; installments: number; pixQrCode: string | null; pixQrCodeImage: string | null; pixExpiresAt: string | null; cardBrand: string | null; cardLast4: string | null; failureReason: string | null; isSandbox: boolean };

/**
 * Acompanhamento do pagamento: QR PIX com expiração, polling seguro do status
 * (somente do próprio usuário) e, no gateway dev, botões que disparam o MESMO
 * webhook assinado usado em produção.
 */
export function PaymentStatus({ checkoutId, status: initialStatus, payment, expiresAt, totalCents, gateway }: { checkoutId: string; status: string; payment: Payment | null; expiresAt: string; totalCents: number; gateway: { name: string; isSandbox: boolean } }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState(payment?.status ?? "PENDING");
  const [pending, start] = useTransition();
  const [retryMethod, setRetryMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [card, setCard] = useState<CardTokenResult | null>(null);

  useEffect(() => {
    if (status !== "PENDING_PAYMENT") return;
    const t = window.setInterval(async () => {
      const res = await getCheckoutStatusAction({ checkoutId });
      if (!res.ok) return;
      setStatus(res.data.status);
      setPaymentStatus(res.data.paymentStatus ?? "PENDING");
      if (res.data.status !== "PENDING_PAYMENT") router.refresh();
    }, 4000);
    return () => window.clearInterval(t);
  }, [status, checkoutId, router]);

  useEffect(() => {
    if (status === "PAID") router.replace(`/checkout/confirmacao/${checkoutId}`);
  }, [status, checkoutId, router]);

  const simulate = (outcome: "approve" | "decline" | "expire") =>
    start(async () => {
      const res = await fetch("/api/dev/payments/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutId, outcome }) });
      if (!res.ok) toast.error("Não foi possível simular", { description: ((await res.json().catch(() => ({}))) as { error?: string }).error });
      router.refresh();
      const s = await getCheckoutStatusAction({ checkoutId });
      if (s.ok) {
        setStatus(s.data.status);
        setPaymentStatus(s.data.paymentStatus ?? "PENDING");
      }
    });

  if (status === "EXPIRED" || status === "CANCELLED") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface p-8 text-center">
        <XCircle className="size-12 text-danger-600" aria-hidden />
        <h2 className="text-xl font-bold">{status === "EXPIRED" ? "O prazo para pagamento terminou" : "Compra cancelada"}</h2>
        <p className="max-w-md text-sm text-fg-muted">Os itens foram liberados. Você pode montar o carrinho novamente e gerar um novo pagamento.</p>
        <ButtonLink href="/carrinho">Voltar ao carrinho</ButtonLink>
      </div>
    );
  }

  const failed = paymentStatus === "FAILED";
  return (
    <div className="flex flex-col gap-4">
      {gateway.isSandbox ? (
        <Alert tone="warning" title="Ambiente de demonstração">
          Este pagamento é simulado: o QR Code abaixo <strong>não é um PIX válido</strong> e nenhuma cobrança será feita.
        </Alert>
      ) : null}

      {payment?.method === "PIX" && !failed ? (
        <div className="grid gap-5 rounded-panel border border-line bg-surface p-5 sm:grid-cols-[240px_minmax(0,1fr)]">
          <div className="mx-auto flex flex-col items-center gap-2">
            {payment.pixQrCodeImage ? <Image src={payment.pixQrCodeImage} alt="QR Code para pagamento via PIX" width={240} height={240} unoptimized className="rounded-md border border-line" /> : <QrCode className="size-40 text-fg-subtle" aria-hidden />}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-lg font-bold">Pague com PIX para concluir</h2>
            <p className="text-2xl font-extrabold tabular">{formatBRL(payment.amountCents)}</p>
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Clock className="size-4" aria-hidden /> O código expira em <Countdown endsAt={payment.pixExpiresAt ?? expiresAt} variant="inline" className="font-bold text-fg" refreshOnExpire />
            </p>
            <ol className="list-inside list-decimal text-sm text-fg-muted">
              <li>Abra o app do seu banco e escolha pagar com PIX.</li>
              <li>Escaneie o QR Code ou use o código copia e cola.</li>
              <li>Confirme o pagamento. A aprovação é automática.</li>
            </ol>
            {payment.pixQrCode ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="pix-code" className="text-xs font-semibold text-fg-muted">
                  PIX copia e cola
                </label>
                <textarea id="pix-code" readOnly value={payment.pixQrCode} rows={3} className="w-full resize-none rounded-md border border-line bg-surface-muted p-2 font-mono text-xs break-all" />
                <CopyButton value={payment.pixQrCode} label="Copiar código PIX" />
              </div>
            ) : null}
            <p className="flex items-center gap-2 text-xs text-fg-subtle" aria-live="polite">
              <RefreshCw className="size-3.5 animate-spin" aria-hidden /> Aguardando a confirmação do pagamento…
            </p>
          </div>
        </div>
      ) : null}

      {payment?.method === "CREDIT_CARD" && !failed && paymentStatus !== "PAID" ? (
        <Alert tone="info" title="Processando pagamento com cartão">
          Estamos aguardando a confirmação da operadora.
        </Alert>
      ) : null}

      {failed ? (
        <div className="flex flex-col gap-4 rounded-panel border border-danger-600/30 bg-surface p-5">
          <p className="flex items-center gap-2 text-base font-bold text-danger-700">
            <AlertTriangle className="size-5" aria-hidden /> Pagamento não aprovado
          </p>
          <p className="text-sm text-fg-muted">{payment?.failureReason ?? "O pagamento foi recusado."} Os itens continuam reservados até o prazo terminar. Tente outra forma de pagamento:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={retryMethod === "PIX" ? "secondary" : "outline"} onClick={() => setRetryMethod("PIX")}>
              PIX
            </Button>
            <Button variant={retryMethod === "CREDIT_CARD" ? "secondary" : "outline"} onClick={() => setRetryMethod("CREDIT_CARD")}>
              Outro cartão
            </Button>
          </div>
          {retryMethod === "CREDIT_CARD" ? <CardTokenizer gateway={gateway.name} amountCents={totalCents} onToken={setCard} /> : null}
          <Button
            loading={pending}
            className="self-start"
            onClick={() =>
              start(async () => {
                const res = await retryPaymentAction({ checkoutId, method: retryMethod, installments: 1, cardToken: card?.token, cardPaymentMethodId: card?.paymentMethodId, cardIssuerId: card?.issuerId });
                if (!res.ok) return toast.error(res.error);
                setPaymentStatus(res.data.status);
                router.refresh();
              })
            }
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {gateway.name === "dev" ? (
        <div className="rounded-panel border border-dashed border-warning-600/40 bg-warning-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning-700">
            <FlaskConical className="size-4" aria-hidden /> Simulador do gateway (somente desenvolvimento)
          </p>
          <p className="mb-3 text-xs text-fg-muted">Dispara um webhook assinado pelo mesmo caminho usado em produção.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" leftIcon={<CheckCircle2 className="size-4" />} loading={pending} onClick={() => simulate("approve")}>
              Simular pagamento aprovado
            </Button>
            <Button size="sm" variant="outline" onClick={() => simulate("decline")} disabled={pending}>
              Simular recusa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => simulate("expire")} disabled={pending}>
              Simular expiração
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Cancelar esta compra? Os itens serão liberados.")) return;
            start(async () => {
              const res = await cancelPendingCheckoutAction({ checkoutId });
              if (!res.ok) return toast.error(res.error);
              toast.success(res.message ?? "Compra cancelada.");
              setStatus("CANCELLED");
            });
          }}
        >
          Cancelar compra
        </Button>
      </div>
    </div>
  );
}
