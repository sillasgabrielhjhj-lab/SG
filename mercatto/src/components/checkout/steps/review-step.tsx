import { ArrowLeft, ExternalLink, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";
import type { ShippingOption } from "@/lib/shipping";
import type { CheckoutAddress, CheckoutItem } from "@/components/checkout/checkout-wizard";
import type { CartSummary } from "@/lib/cart-summary";

const PAYMENT_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  PIX: "Pix",
  BOLETO: "Boleto",
};

export function ReviewStep({
  address,
  shipping,
  paymentMethod,
  installments,
  items,
  summary,
  formAction,
  isPending,
  errorMessage,
  hiddenFields,
  usesExternalCheckout = false,
  onBack,
}: {
  address: CheckoutAddress;
  shipping: ShippingOption;
  paymentMethod: string;
  installments: number;
  items: CheckoutItem[];
  summary: CartSummary;
  formAction: (formData: FormData) => void;
  isPending: boolean;
  errorMessage?: string;
  hiddenFields: Record<string, string>;
  usesExternalCheckout?: boolean;
  onBack: () => void;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Revise seu pedido</h2>

        <div className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="size-12 rounded-md object-cover" />
              <div className="flex-1">
                <p className="text-foreground">{item.productName}</p>
                {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
              </div>
              <p className="font-medium text-foreground">
                {formatCurrencyBRL(item.unitPriceCents * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Entregar em</p>
            <p className="mt-1 text-sm text-foreground">
              {address.recipientName} — {address.street}, {address.number}
              {address.complement ? ` (${address.complement})` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {address.neighborhood}, {address.city} - {address.state} · {address.zipCode}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Entrega</p>
            <p className="mt-1 text-sm text-foreground">
              {shipping.label} — até {shipping.days} dias úteis
            </p>
            <p className="text-xs font-semibold text-muted-foreground uppercase mt-3">Pagamento</p>
            <p className="mt-1 text-sm text-foreground">
              {usesExternalCheckout
                ? "Escolha na próxima tela (Mercado Pago)"
                : `${PAYMENT_LABELS[paymentMethod]}${paymentMethod === "CREDIT_CARD" && installments > 1 ? ` em ${installments}x` : ""}`}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-5">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrencyBRL(summary.subtotalCents)}</span>
          </div>
          {summary.discountCents > 0 && (
            <div className="flex justify-between text-success">
              <span>Desconto</span>
              <span>-{formatCurrencyBRL(summary.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Frete</span>
            <span>{summary.shippingCents === 0 ? "Grátis" : formatCurrencyBRL(summary.shippingCents)}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-lg font-bold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyBRL(summary.totalCents)}</span>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button type="submit" size="lg" disabled={isPending} className="flex-1 sm:flex-none">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : usesExternalCheckout ? (
            <ExternalLink className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
          {usesExternalCheckout ? "Ir para o Mercado Pago" : "Confirmar pedido"}
        </Button>
      </div>
    </form>
  );
}
