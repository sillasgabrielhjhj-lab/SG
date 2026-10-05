"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, FlaskConical, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { centsToInput } from "@/lib/money";
import { Alert } from "@/components/ui/alert";

export type CardTokenResult = { token: string; paymentMethodId?: string; issuerId?: string; label: string };

/**
 * Tokenização de cartão. O número do cartão NUNCA passa pelo servidor da
 * Mercatto: o SDK do gateway gera um token no navegador.
 *  - gateway "dev": cartões de TESTE (aprovar/recusar) — nenhum dado real.
 *  - gateway "mercadopago": Card Payment Brick oficial (requer
 *    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY e liberação do domínio do SDK na CSP).
 */
export function CardTokenizer({ gateway, amountCents, onToken }: { gateway: string; amountCents: number; onToken: (t: CardTokenResult | null) => void }) {
  if (gateway === "dev") return <DevCardSelector onToken={onToken} />;
  if (gateway === "mercadopago") return <MercadoPagoBrick amountCents={amountCents} onToken={onToken} />;
  return <Alert tone="warning">Pagamento com cartão indisponível neste gateway.</Alert>;
}

function DevCardSelector({ onToken }: { onToken: (t: CardTokenResult | null) => void }) {
  const [choice, setChoice] = useState<"dev_approved" | "dev_declined">("dev_approved");
  useEffect(() => onToken({ token: choice, label: choice === "dev_approved" ? "de teste (aprovado)" : "de teste (recusado)" }), [choice, onToken]);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-700">
        <FlaskConical className="size-4" aria-hidden /> Modo desenvolvimento: use um cartão de teste. Não digite dados de cartões reais.
      </p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cartão de teste">
        {(
          [
            ["dev_approved", "Cartão de teste — aprovado", CheckCircle2, "text-success-700"],
            ["dev_declined", "Cartão de teste — recusado", XCircle, "text-danger-700"],
          ] as const
        ).map(([value, label, Icon, color]) => (
          <button key={value} type="button" role="radio" aria-checked={choice === value} onClick={() => setChoice(value)} className={cn("flex items-center gap-2 rounded-card border bg-surface p-3 text-left text-sm font-medium transition-colors focus-ring", choice === value ? "border-brand-600 shadow-[inset_0_0_0_1px_var(--color-brand-600)]" : "border-line hover:border-brand-400")}>
            <CreditCard className="size-5 text-fg-subtle" aria-hidden />
            <span className="flex-1">{label}</span>
            <Icon className={cn("size-4", color)} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    MercadoPago?: new (key: string, opts?: { locale?: string }) => { bricks: () => { create: (type: string, id: string, settings: unknown) => Promise<{ unmount: () => void }> } };
  }
}

function MercadoPagoBrick({ amountCents, onToken }: { amountCents: number; onToken: (t: CardTokenResult | null) => void }) {
  const ref = useRef<{ unmount: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    const mount = async () => {
      if (!window.MercadoPago) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://sdk.mercadopago.com/js/v2";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("SDK indisponível"));
          document.head.appendChild(s);
        });
      }
      if (cancelled || !window.MercadoPago) return;
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      ref.current = await mp.bricks().create("cardPayment", "mp-card-brick", {
        initialization: { amount: Number(centsToInput(amountCents).replace(",", ".")) },
        customization: { visual: { hidePaymentButton: false } },
        callbacks: {
          onReady: () => undefined,
          onError: () => setError("Não foi possível carregar o formulário do cartão."),
          onSubmit: async (data: { token: string; payment_method_id: string; issuer_id: string }) => {
            onToken({ token: data.token, paymentMethodId: data.payment_method_id, issuerId: data.issuer_id, label: data.payment_method_id });
          },
        },
      });
    };
    mount().catch(() => setError("Não foi possível carregar o formulário do cartão."));
    return () => {
      cancelled = true;
      ref.current?.unmount();
    };
  }, [publicKey, amountCents, onToken]);
  if (!publicKey) return <Alert tone="warning" title="Cartão indisponível">Configure NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY para habilitar o formulário seguro de cartão.</Alert>;
  return (
    <div>
      <div id="mp-card-brick" />
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
