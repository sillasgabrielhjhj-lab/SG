import "server-only";

export type PaymentMethodInput =
  | { method: "CREDIT_CARD"; installments: number; cardLast4: string }
  | { method: "PIX" }
  | { method: "BOLETO" };

export type ChargeInput = {
  orderNumber: string;
  amountCents: number;
  payment: PaymentMethodInput;
};

export type ChargeResult = {
  status: "APPROVED" | "DECLINED" | "PENDING";
  externalReference: string;
};

export interface PaymentProvider {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

/**
 * Implementação mock — nenhuma cobrança real acontece, nenhum dado de
 * cartão é validado ou armazenado de verdade. Serve só para o fluxo de
 * checkout funcionar fim a fim enquanto nenhum gateway real está
 * conectado. Para produção, troque `getPaymentProvider()` por uma
 * implementação real (ex: Mercado Pago, Stripe) que satisfaça a mesma
 * interface `PaymentProvider` — nada no checkout precisa mudar.
 */
class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const externalReference = `MOCK-${input.orderNumber}-${Date.now()}`;

    if (input.payment.method === "PIX" || input.payment.method === "BOLETO") {
      // Em um gateway real, Pix/boleto ficam pendentes até o pagador
      // confirmar. Aqui aprovamos na hora para o fluxo demo ficar completo.
      return { status: "APPROVED", externalReference };
    }

    return { status: "APPROVED", externalReference };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}
