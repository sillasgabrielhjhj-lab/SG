import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";

export function ConfirmationStep({
  orderNumber,
  totalCents,
}: {
  orderNumber: string;
  totalCents: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CheckoutProgress current="confirmacao" />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-border p-10 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Pedido confirmado!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedido <span className="font-medium text-foreground">{orderNumber}</span> no valor de{" "}
            <span className="font-medium text-foreground">{formatCurrencyBRL(totalCents)}</span>
          </p>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          Você pode acompanhar o status, rastreio e detalhes deste pedido a qualquer momento em
          Meus pedidos.
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
