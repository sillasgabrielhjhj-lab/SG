import "server-only";
import { env } from "@/server/env";
import { DevPaymentGateway } from "@/server/providers/payments/dev";
import { MercadoPagoGateway } from "@/server/providers/payments/mercadopago";
import { StripeGateway } from "@/server/providers/payments/stripe";
import type { PaymentGateway } from "@/server/providers/payments/types";

let instance: PaymentGateway | null = null;

/** Gateway de pagamento configurado (PAYMENT_PROVIDER). */
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;
  switch (env.PAYMENT_PROVIDER) {
    case "mercadopago":
      instance = new MercadoPagoGateway({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN ?? "", webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET ?? null });
      break;
    case "stripe":
      instance = new StripeGateway({
        secretKey: env.STRIPE_SECRET_KEY ?? "",
        publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
        pixEnabled: env.STRIPE_PIX_ENABLED,
      });
      break;
    default:
      instance = new DevPaymentGateway();
  }
  return instance;
}

export type { PaymentGateway } from "@/server/providers/payments/types";

/**
 * Pagamentos em modo de teste (gateway de desenvolvimento ou credenciais de
 * teste do Mercado Pago/Stripe): a loja exibe a faixa "Ambiente de demonstração".
 * Não instancia o gateway (não falha se as credenciais estiverem incompletas).
 */
export function isSandboxPayments(): boolean {
  if (env.PAYMENT_PROVIDER === "dev") return true;
  if (env.PAYMENT_PROVIDER === "stripe") return !/^(sk|rk)_live_/.test((env.STRIPE_SECRET_KEY ?? "").trim());
  return (env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-");
}

/**
 * Quem calcula os juros do parcelamento no cartão:
 *  - "app":     a Mercatto aplica a Tabela Price da configuração (gateway dev);
 *  - "gateway": o gateway cobra conforme a conta (Mercado Pago) — envia-se o valor base;
 *  - "none":    sem juros para o comprador (parcelado lojista da Stripe) — todas
 *               as parcelas são exibidas e cobradas pelo valor base.
 */
export function installmentInterestPolicy(): "app" | "gateway" | "none" {
  if (env.PAYMENT_PROVIDER === "stripe") return "none";
  if (env.PAYMENT_PROVIDER === "mercadopago") return "gateway";
  return "app";
}
