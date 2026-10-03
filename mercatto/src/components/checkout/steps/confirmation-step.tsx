"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";

export function ConfirmationStep({
  orderNumber,
  totalCents,
  isPaymentPending = false,
}: {
  orderNumber: string;
  totalCents: number;
  /** true quando o pedido ainda está AWAITING_PAYMENT — o gateway redirecionou
   * de volta antes do webhook confirmar o pagamento. */
  isPaymentPending?: boolean;
}) {
  const router = useRouter();

  // O webhook do gateway costuma chegar segundos depois do redirecionamento
  // de volta — uma atualização automática evita que o cliente fique preso
  // numa tela de "processando" que já está desatualizada.
  useEffect(() => {
    if (!isPaymentPending) return;
    const timer = setTimeout(() => router.refresh(), 4000);
    return () => clearTimeout(timer);
  }, [isPaymentPending, router]);

  return (
    <div className="flex flex-col gap-6">
      <CheckoutProgress current="confirmacao" />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-border p-10 text-center">
        {isPaymentPending ? (
          <Loader2 className="size-14 animate-spin text-primary" />
        ) : (
          <CheckCircle2 className="size-14 text-success" />
        )}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isPaymentPending ? "Confirmando seu pagamento..." : "Pedido confirmado!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedido <span className="font-medium text-foreground">{orderNumber}</span> no valor de{" "}
            <span className="font-medium text-foreground">{formatCurrencyBRL(totalCents)}</span>
          </p>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          {isPaymentPending
            ? "Assim que o pagamento for aprovado esta página atualiza sozinha. Você também pode acompanhar pelo Meus pedidos."
            : "Você pode acompanhar o status, rastreio e detalhes deste pedido a qualquer momento em Meus pedidos."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/minha-conta/pedidos">Ver meus pedidos</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Continuar comprando</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
