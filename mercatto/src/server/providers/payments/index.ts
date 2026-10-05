import "server-only";
import { env } from "@/server/env";
import { DevPaymentGateway } from "@/server/providers/payments/dev";
import { MercadoPagoGateway } from "@/server/providers/payments/mercadopago";
import type { PaymentGateway } from "@/server/providers/payments/types";

let instance: PaymentGateway | null = null;

/** Gateway de pagamento configurado (PAYMENT_PROVIDER). */
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;
  instance =
    env.PAYMENT_PROVIDER === "mercadopago"
      ? new MercadoPagoGateway({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN ?? "", webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET ?? null })
      : new DevPaymentGateway();
  return instance;
}

export type { PaymentGateway } from "@/server/providers/payments/types";
