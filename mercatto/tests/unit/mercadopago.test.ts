import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MercadoPagoGateway, buildMercadoPagoManifest, mapMercadoPagoStatus, toMercadoPagoDate, verifyMercadoPagoSignature } from "@/server/providers/payments/mercadopago";

const SECRET = "segredo-de-teste-do-painel";
const sign = (manifest: string) => createHmac("sha256", SECRET).update(manifest).digest("hex");

describe("Mercado Pago — webhook", () => {
  it("monta o manifesto oficial (id em minúsculas, partes ausentes omitidas)", () => {
    expect(buildMercadoPagoManifest({ dataId: "123456", requestId: "req-1", ts: "1700000000" })).toBe("id:123456;request-id:req-1;ts:1700000000;");
    expect(buildMercadoPagoManifest({ dataId: "ABC123", requestId: null, ts: "1" })).toBe("id:abc123;ts:1;");
  });

  it("aceita assinatura válida e recusa adulterações", () => {
    const ts = "1700000000";
    const v1 = sign(`id:987654;request-id:abc;ts:${ts};`);
    const ok = { secret: SECRET, signatureHeader: `ts=${ts},v1=${v1}`, requestId: "abc", dataId: "987654" };
    expect(verifyMercadoPagoSignature(ok)).toBe(true);
    expect(verifyMercadoPagoSignature({ ...ok, dataId: "987655" })).toBe(false); // outro pagamento
    expect(verifyMercadoPagoSignature({ ...ok, requestId: "xyz" })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, secret: "outro-segredo" })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, signatureHeader: `ts=${ts},v1=${"0".repeat(64)}` })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, signatureHeader: null })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, signatureHeader: "lixo" })).toBe(false);
  });
});

describe("Mercado Pago — status e datas", () => {
  it("mapeia status sem nunca confirmar pagamento por engano", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("PAID");
    expect(mapMercadoPagoStatus("approved", "partially_refunded")).toBe("PARTIALLY_REFUNDED");
    expect(mapMercadoPagoStatus("in_process")).toBe("PENDING");
    expect(mapMercadoPagoStatus("rejected")).toBe("FAILED");
    expect(mapMercadoPagoStatus("cancelled", "expired")).toBe("EXPIRED");
    expect(mapMercadoPagoStatus("charged_back")).toBe("REFUNDED");
    expect(mapMercadoPagoStatus("algo_novo")).toBe("PENDING");
  });

  it("formata a expiração do PIX no fuso de Brasília preservando o instante", () => {
    const d = new Date("2026-10-05T15:30:00.000Z");
    const formatted = toMercadoPagoDate(d);
    expect(formatted).toBe("2026-10-05T12:30:00.000-03:00");
    expect(new Date(formatted).getTime()).toBe(d.getTime());
  });
});

describe("Mercado Pago — corpo do pagamento", () => {
  const gateway = new MercadoPagoGateway({ accessToken: "TEST-123", webhookSecret: SECRET });
  const base = {
    idempotencyKey: "k",
    paymentId: "pay_1",
    amountCents: 123456,
    description: "Mercatto — pedido MRC-1",
    payer: { name: "Maria da Silva Souza", email: "maria@exemplo.com", cpf: "529.982.247-25", phone: null },
    notificationUrl: "https://loja.exemplo.com/api/webhooks/payments/mercadopago",
    expiresAt: new Date("2026-10-05T16:00:00.000Z"),
  };

  it("PIX: valor em reais, CPF só dígitos, expiração e referência externa", () => {
    const body = gateway.buildCreatePaymentBody({ ...base, method: "PIX", installments: 1, cardToken: null, paymentMethodId: null, issuerId: null } as Parameters<typeof gateway.buildCreatePaymentBody>[0]);
    expect(body.transaction_amount).toBe(1234.56);
    expect(body.payment_method_id).toBe("pix");
    expect(body.external_reference).toBe("pay_1");
    expect((body.payer as { identification: { number: string } }).identification.number).toBe("52998224725");
    expect((body.payer as { first_name: string; last_name: string }).last_name).toBe("da Silva Souza");
    expect(body.notification_url).toBe(base.notificationUrl);
    expect(body.date_of_expiration).toBe("2026-10-05T13:00:00.000-03:00");
  });

  it("cartão: envia token, parcelas e emissor; nunca dados do cartão", () => {
    const body = gateway.buildCreatePaymentBody({ ...base, method: "CREDIT_CARD", installments: 3, cardToken: "tok_abc", paymentMethodId: "master", issuerId: "24" } as Parameters<typeof gateway.buildCreatePaymentBody>[0]);
    expect(body.token).toBe("tok_abc");
    expect(body.installments).toBe(3);
    expect(body.issuer_id).toBe(24);
    expect(JSON.stringify(body)).not.toMatch(/card_number|security_code|cvv/i);
  });

  it("não envia notification_url sem HTTPS e marca credenciais TEST- como sandbox", () => {
    const body = gateway.buildCreatePaymentBody({ ...base, notificationUrl: "http://localhost:3000/x", method: "PIX", installments: 1, cardToken: null, paymentMethodId: null, issuerId: null } as Parameters<typeof gateway.buildCreatePaymentBody>[0]);
    expect(body.notification_url).toBeUndefined();
    expect(gateway.isSandbox).toBe(true);
    expect(new MercadoPagoGateway({ accessToken: "APP_USR-1" }).isSandbox).toBe(false);
  });
});
