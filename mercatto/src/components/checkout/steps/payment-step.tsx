import { CreditCard, QrCode, Barcode, ArrowLeft, ArrowRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyBRL, formatInstallments } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type CardDetails = { number: string; name: string; expiry: string; cvv: string };
type Method = "CREDIT_CARD" | "PIX" | "BOLETO";

const METHODS: { id: Method; label: string; icon: typeof CreditCard }[] = [
  { id: "CREDIT_CARD", label: "Cartão de crédito", icon: CreditCard },
  { id: "PIX", label: "Pix", icon: QrCode },
  { id: "BOLETO", label: "Boleto", icon: Barcode },
];

export function PaymentStep({
  method,
  onMethodChange,
  installments,
  onInstallmentsChange,
  card,
  onCardChange,
  totalCents,
  usesExternalCheckout = false,
  onBack,
  onContinue,
}: {
  method: Method;
  onMethodChange: (m: Method) => void;
  installments: number;
  onInstallmentsChange: (n: number) => void;
  card: CardDetails;
  onCardChange: (c: CardDetails) => void;
  totalCents: number;
  usesExternalCheckout?: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const cardComplete =
    usesExternalCheckout ||
    method !== "CREDIT_CARD" ||
    (card.number.replace(/\D/g, "").length >= 13 && card.name.trim().length > 2 && card.expiry.length >= 4 && card.cvv.length >= 3);

  if (usesExternalCheckout) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Pagamento</h2>
        <div className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Na próxima etapa você será levado a uma página segura do Mercado Pago para escolher entre
          cartão, Pix ou boleto e concluir o pagamento.
        </div>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{formatCurrencyBRL(totalCents)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <Button onClick={onContinue}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Como você quer pagar?</h2>

      <div className="flex gap-2">
        {METHODS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onMethodChange(id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
              method === id ? "border-primary bg-secondary/50 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>

      {method === "CREDIT_CARD" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" /> Ambiente de teste — nenhum cartão real é cobrado.
          </div>

          <div>
            <Label htmlFor="cardNumber">Número do cartão</Label>
            <Input
              id="cardNumber"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={card.number}
              onChange={(e) => onCardChange({ ...card, number: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="cardName">Nome impresso no cartão</Label>
            <Input
              id="cardName"
              value={card.name}
              onChange={(e) => onCardChange({ ...card, name: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cardExpiry">Validade</Label>
              <Input
                id="cardExpiry"
                placeholder="MM/AA"
                maxLength={5}
                value={card.expiry}
                onChange={(e) => onCardChange({ ...card, expiry: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cardCvv">CVV</Label>
              <Input
                id="cardCvv"
                inputMode="numeric"
                maxLength={4}
                value={card.cvv}
                onChange={(e) => onCardChange({ ...card, cvv: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="installments">Parcelas</Label>
            <select
              id="installments"
              value={installments}
              onChange={(e) => onInstallmentsChange(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x de {formatCurrencyBRL(totalCents / n)} {n === 1 ? "à vista" : "sem juros"}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {method === "PIX" && (
        <p className="text-sm text-muted-foreground">
          Você vai receber o código Pix para pagamento depois de confirmar o pedido.
        </p>
      )}

      {method === "BOLETO" && (
        <p className="text-sm text-muted-foreground">
          O boleto será gerado depois de confirmar o pedido, com vencimento em 3 dias úteis.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Total: <span className="font-medium text-foreground">{formatCurrencyBRL(totalCents)}</span>
        {method === "CREDIT_CARD" && installments > 1 && (
          <> — {formatInstallments(totalCents, installments)}</>
        )}
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button onClick={onContinue} disabled={!cardComplete}>
          Continuar <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
