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

export type CheckoutRedirectInput = {
  orderNumber: string;
  amountCents: number;
  payerEmail: string;
  items: { title: string; quantity: number; unitPriceCents: number }[];
};

export type CheckoutRedirectResult = {
  /** id da preferência/sessão no gateway — guardado em Payment.externalReference
   * até o webhook confirmar o pagamento e substituir pelo id real do pagamento. */
  referenceId: string;
  redirectUrl: string;
};

/**
 * Duas formas de gateway de pagamento:
 * - síncrono (`charge`): decide aprovado/recusado na hora, sem sair do site
 *   (é o que o MockPaymentProvider faz).
 * - por redirecionamento (`createCheckout`): o comprador sai do site, paga
 *   numa página hospedada pelo gateway, e volta — a confirmação real chega
 *   depois, por webhook (é o caso do Mercado Pago Checkout Pro).
 * Cada provider implementa só o método correspondente ao seu modelo.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly isRedirectBased: boolean;
  charge?(input: ChargeInput): Promise<ChargeResult>;
  createCheckout?(input: CheckoutRedirectInput): Promise<CheckoutRedirectResult>;
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
  readonly isRedirectBased = false;

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

let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;

  if (process.env.PAYMENT_PROVIDER === "mercadopago") {
    // import tardio: evita carregar o SDK do Mercado Pago (e exigir as
    // variáveis de ambiente dele) em ambientes que usam o mock, como os
    // testes automatizados.
    const { MercadoPagoProvider } = require("./mercadopago") as typeof import("./mercadopago");
    cachedProvider = new MercadoPagoProvider();
  } else {
    cachedProvider = new MockPaymentProvider();
  }

  return cachedProvider;
}
