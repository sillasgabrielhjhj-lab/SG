"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, FlaskConical, Lock, XCircle } from "lucide-react";
import type { Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cardBrandName, getStripe } from "@/features/checkout/components/stripe-client";

export type CardTokenResult = { token: string; paymentMethodId?: string; issuerId?: string; label: string };

/**
 * Tokenização de cartão. O número do cartão NUNCA passa pelo servidor da
 * Mercatto: o SDK do gateway gera um token no navegador.
 *  - gateway "dev": cartões de TESTE (aprovar/recusar) — nenhum dado real.
 *  - gateway "mercadopago": Card Payment Brick oficial (requer
 *    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY e liberação do domínio do SDK na CSP).
 *  - gateway "stripe": Payment Element oficial (iframe da Stripe) gera um
 *    PaymentMethod (pm_...); requer STRIPE_PUBLISHABLE_KEY (publicKey).
 */
export function CardTokenizer({ gateway, publicKey, amountCents, onToken }: { gateway: string; publicKey?: string | null; amountCents: number; onToken: (t: CardTokenResult | null) => void }) {
  if (gateway === "dev") return <DevCardSelector onToken={onToken} />;
  if (gateway === "mercadopago") return <MercadoPagoBrick amountCents={amountCents} onToken={onToken} />;
  if (gateway === "stripe") {
    if (!publicKey) return <Alert tone="warning" title="Cartão indisponível">Configure STRIPE_PUBLISHABLE_KEY para habilitar o formulário seguro de cartão.</Alert>;
    return <StripeCardForm publicKey={publicKey} amountCents={amountCents} onToken={onToken} />;
  }
  return <Alert tone="warning">Pagamento com cartão indisponível neste gateway.</Alert>;
}

/** Valor mínimo aceito pela Stripe em BRL (R$ 0,50) — usado só na exibição do formulário. */
const STRIPE_MIN_AMOUNT = 50;

function StripeCardForm({ publicKey, amountCents, onToken }: { publicKey: string; amountCents: number; onToken: (t: CardTokenResult | null) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);
  const amount = Math.max(amountCents, STRIPE_MIN_AMOUNT);
  const amountRef = useRef(amount);
  const savedRef = useRef(false);
  const onTokenRef = useRef(onToken);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  // O total muda (frete, cupom) sem recriar o formulário nem apagar o cartão digitado.
  useEffect(() => {
    amountRef.current = amount;
    ctx.current?.elements.update({ amount });
  }, [amount]);

  useEffect(() => {
    let cancelled = false;
    let element: StripePaymentElement | null = null;
    getStripe(publicKey)
      .then((stripe) => {
        if (cancelled) return;
        if (!stripe || !mountRef.current) return setError("Não foi possível carregar o formulário do cartão.");
        const elements = stripe.elements({
          mode: "payment",
          amount: amountRef.current,
          currency: "brl",
          paymentMethodTypes: ["card"],
          paymentMethodCreation: "manual",
          locale: "pt-BR",
          appearance: { theme: "stripe", variables: { borderRadius: "8px" } },
        });
        element = elements.create("payment", { layout: "tabs", wallets: { applePay: "never", googlePay: "never" } });
        element.on("ready", () => setReady(true));
        // Cartão alterado depois de confirmado: o token anterior deixa de valer.
        element.on("change", () => {
          if (!savedRef.current) return;
          savedRef.current = false;
          setSaved(null);
          onTokenRef.current(null);
        });
        element.mount(mountRef.current);
        ctx.current = { stripe, elements };
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o formulário do cartão. Verifique sua conexão e recarregue a página.");
      });
    return () => {
      cancelled = true;
      element?.destroy();
      ctx.current = null;
    };
  }, [publicKey]);

  const confirmCard = async () => {
    const current = ctx.current;
    if (!current) return;
    setBusy(true);
    setError(null);
    const submitted = await current.elements.submit();
    if (submitted.error) {
      setBusy(false);
      return setError(submitted.error.message ?? "Revise os dados do cartão.");
    }
    const { error: createError, paymentMethod } = await current.stripe.createPaymentMethod({ elements: current.elements });
    setBusy(false);
    if (createError || !paymentMethod) return setError(createError?.message ?? "Não foi possível validar o cartão. Tente novamente.");
    const label = paymentMethod.card ? `${cardBrandName(paymentMethod.card.brand)} final ${paymentMethod.card.last4}` : "cartão";
    savedRef.current = true;
    setSaved(label);
    onTokenRef.current({ token: paymentMethod.id, label });
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={mountRef} className={cn(!ready && error ? "hidden" : "min-h-[120px]")} aria-busy={!ready} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success-700" role="status">
          <CheckCircle2 className="size-4" aria-hidden /> {saved} confirmado. Para trocar, altere os dados acima.
        </p>
      ) : (
        <Button type="button" variant="secondary" className="self-start" loading={busy} disabled={!ready} onClick={confirmCard}>
          Usar este cartão
        </Button>
      )}
      <p className="flex items-center gap-1.5 text-xs text-fg-muted">
        <Lock className="size-3.5" aria-hidden /> Dados do cartão enviados direto para a Stripe. A Mercatto não recebe nem guarda o número do cartão.
      </p>
    </div>
  );
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
        initialization: { amount: amountCents / 100 },
        // Parcelas são escolhidas no checkout da Mercatto (evita dois seletores).
        customization: { visual: { hidePaymentButton: false }, paymentMethods: { maxInstallments: 1 } },
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
