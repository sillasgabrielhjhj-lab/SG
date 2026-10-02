import "server-only";

import { MercadoPagoConfig, Preference } from "mercadopago";

import type { CheckoutRedirectInput, CheckoutRedirectResult, PaymentProvider } from "./provider";

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  }
  return token;
}

/**
 * Checkout Pro: o comprador é redirecionado para uma página hospedada pelo
 * Mercado Pago (onde escolhe cartão/Pix/boleto), e volta depois. A
 * confirmação definitiva do pagamento chega pelo webhook
 * (`/api/webhooks/mercadopago`), nunca pelo redirecionamento de volta —
 * o comprador pode fechar a aba antes de voltar, por exemplo.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";
  readonly isRedirectBased = true;

  async createCheckout(input: CheckoutRedirectInput): Promise<CheckoutRedirectResult> {
    const client = new MercadoPagoConfig({ accessToken: getAccessToken() });
    const preference = new Preference(client);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL não configurado — necessário para back_urls e notification_url.");
    }

    const response = await preference.create({
      body: {
        items: input.items.map((item) => ({
          id: item.title.slice(0, 50),
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPriceCents / 100,
          currency_id: "BRL",
        })),
        payer: { email: input.payerEmail },
        external_reference: input.orderNumber,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${appUrl}/pedido-confirmado/${input.orderNumber}`,
          pending: `${appUrl}/pedido-confirmado/${input.orderNumber}`,
          failure: `${appUrl}/checkout?pagamento=recusado`,
        },
        auto_return: "approved",
        statement_descriptor: "MERCATTO",
      },
    });

    if (!response.id || !response.init_point) {
      throw new Error("Mercado Pago não retornou um link de pagamento.");
    }

    return { referenceId: response.id, redirectUrl: response.init_point };
  }
}
