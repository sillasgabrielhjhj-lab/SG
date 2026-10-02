"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { placeOrderAction } from "@/lib/actions/checkout";
import type { PlaceOrderState } from "@/lib/actions/checkout";
import { getShippingOptions } from "@/lib/shipping";
import { computeCartSummary } from "@/lib/cart-summary";
import { CheckoutProgress, type CheckoutStep } from "@/components/checkout/checkout-progress";
import { AddressStep } from "@/components/checkout/steps/address-step";
import { ShippingStep } from "@/components/checkout/steps/shipping-step";
import { PaymentStep, type CardDetails } from "@/components/checkout/steps/payment-step";
import { ReviewStep } from "@/components/checkout/steps/review-step";

export type CheckoutAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
};

export type CheckoutItem = {
  id: string;
  productName: string;
  variantName: string | null;
  imageUrl: string;
  quantity: number;
  unitPriceCents: number;
};

const initialState: PlaceOrderState = { status: "idle" };

export function CheckoutWizard({
  addresses,
  items,
  coupon,
  usesExternalCheckout = false,
}: {
  addresses: CheckoutAddress[];
  items: CheckoutItem[];
  coupon: { code: string; type: "PERCENTAGE" | "FIXED"; value: number; minOrderCents: number } | null;
  /** true quando o gateway ativo redireciona para uma página externa (ex:
   * Mercado Pago Checkout Pro) — aí o método de pagamento é escolhido lá,
   * não neste formulário. */
  usesExternalCheckout?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<CheckoutStep>("endereco");
  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [shippingOptionId, setShippingOptionId] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD" | "PIX" | "BOLETO">("CREDIT_CARD");
  const [installments, setInstallments] = useState(1);
  const [card, setCard] = useState<CardDetails>({ number: "", name: "", expiry: "", cvv: "" });

  // Em caso de sucesso, placeOrderAction redireciona direto para
  // /pedido-confirmado/[orderNumber] (ver src/lib/actions/checkout.ts) —
  // este componente nunca chega a renderizar um estado de sucesso.
  const [actionState, formAction, isPending] = useActionState(placeOrderAction, initialState);

  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;
  const shippingOptions = useMemo(
    () => (selectedAddress ? getShippingOptions(selectedAddress.zipCode) : []),
    [selectedAddress],
  );
  const selectedShipping = shippingOptions.find((o) => o.id === shippingOptionId) ?? shippingOptions[0];

  const summary = computeCartSummary(
    items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    coupon,
    selectedShipping?.costCents ?? 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <CheckoutProgress current={step} />

      {step === "endereco" && (
        <AddressStep
          addresses={addresses}
          selectedId={addressId}
          onSelect={setAddressId}
          onCreated={() => router.refresh()}
          onContinue={() => setStep("entrega")}
        />
      )}

      {step === "entrega" && selectedAddress && (
        <ShippingStep
          options={shippingOptions}
          selectedId={shippingOptionId}
          onSelect={setShippingOptionId}
          onBack={() => setStep("endereco")}
          onContinue={() => setStep("pagamento")}
        />
      )}

      {step === "pagamento" && (
        <PaymentStep
          method={paymentMethod}
          onMethodChange={setPaymentMethod}
          installments={installments}
          onInstallmentsChange={setInstallments}
          card={card}
          onCardChange={setCard}
          totalCents={summary.totalCents}
          usesExternalCheckout={usesExternalCheckout}
          onBack={() => setStep("entrega")}
          onContinue={() => setStep("revisao")}
        />
      )}

      {step === "revisao" && selectedAddress && selectedShipping && (
        <ReviewStep
          address={selectedAddress}
          shipping={selectedShipping}
          paymentMethod={paymentMethod}
          installments={installments}
          items={items}
          summary={summary}
          formAction={formAction}
          isPending={isPending}
          errorMessage={actionState.status === "error" ? actionState.message : undefined}
          usesExternalCheckout={usesExternalCheckout}
          hiddenFields={{
            addressId: selectedAddress.id,
            shippingOptionId,
            paymentMethod,
            installments: String(installments),
            cardNumber: card.number,
            cardName: card.name,
            cardExpiry: card.expiry,
            cardCvv: card.cvv,
          }}
          onBack={() => setStep("pagamento")}
        />
      )}
    </div>
  );
}
