import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STRIPE_API_VERSION,
  StripeGateway,
  describeStripeDecline,
  encodeStripeForm,
  mapStripeStatus,
  verifyStripeSignature,
} from "@/server/providers/payments/stripe";

const WEBHOOK_SECRET = "whsec_segredo_de_teste";
const sign = (payload: string, t: number, secret = WEBHOOK_SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };
function mockFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method), headers: init.headers as Record<string, string>, body: init.body as string | undefined });
      const next = queue.shift();
      if (!next) throw new Error(`requisição inesperada: ${url}`);
      return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

const gateway = (overrides: Partial<ConstructorParameters<typeof StripeGateway>[0]> = {}) =>
  new StripeGateway({ secretKey: "sk_test_123", publishableKey: "pk_test_123", webhookSecret: WEBHOOK_SECRET, ...overrides });

const baseInput = {
  idempotencyKey: "chave-1",
  paymentId: "pay_1",
  amountCents: 12990,
  installments: 1,
  description: "Mercatto — pedido MRC-1",
  payer: { name: "Maria Silva", email: "maria@example.com", cpf: "52998224725" },
  expiresAt: new Date("2026-10-05T16:00:00.000Z"),
  notificationUrl: "https://loja.example/api/webhooks/payments/stripe",
};

const intent = (over: Record<string, unknown> = {}) => ({ id: "pi_3Abc123456", status: "requires_action", amount: 12990, currency: "brl", livemode: false, metadata: { payment_id: "pay_1" }, ...over });

afterEach(() => vi.unstubAllGlobals());

describe("Stripe — funções puras", () => {
  it("codifica parâmetros aninhados no formato da API", () => {
    expect(encodeStripeForm({ amount: 100, payment_method_types: ["pix"], metadata: { payment_id: "p1" }, skip: null, confirm: true })).toBe(
      "amount=100&payment_method_types[0]=pix&metadata[payment_id]=p1&confirm=true",
    );
    expect(encodeStripeForm({ a: { b: { c: "x y" } } })).toBe("a[b][c]=x+y");
  });

  it("mapeia status sem nunca confirmar pagamento por engano", () => {
    expect(mapStripeStatus({ status: "succeeded", amount: 100, amount_received: 100 })).toBe("PAID");
    expect(mapStripeStatus({ status: "succeeded", amount: 100, amount_received: 100, latest_charge: { amount_refunded: 40 } })).toBe("PARTIALLY_REFUNDED");
    expect(mapStripeStatus({ status: "succeeded", amount: 100, amount_received: 100, latest_charge: { amount_refunded: 100 } })).toBe("REFUNDED");
    expect(mapStripeStatus({ status: "requires_action", amount: 100 })).toBe("PENDING");
    expect(mapStripeStatus({ status: "processing", amount: 100 })).toBe("PENDING");
    expect(mapStripeStatus({ status: "requires_capture", amount: 100 })).toBe("AUTHORIZED");
    expect(mapStripeStatus({ status: "requires_payment_method", amount: 100 })).toBe("PENDING");
    expect(mapStripeStatus({ status: "requires_payment_method", amount: 100, last_payment_error: { code: "card_declined" } })).toBe("FAILED");
    expect(mapStripeStatus({ status: "requires_payment_method", amount: 100, last_payment_error: { code: "payment_intent_payment_attempt_expired" } })).toBe("EXPIRED");
    expect(mapStripeStatus({ status: "canceled", amount: 100, cancellation_reason: "expired" })).toBe("EXPIRED");
    expect(mapStripeStatus({ status: "canceled", amount: 100, cancellation_reason: "requested_by_customer" })).toBe("CANCELLED");
    expect(mapStripeStatus({ status: "algo_novo", amount: 100 })).toBe("PENDING");
  });

  it("traduz recusas do cartão", () => {
    expect(describeStripeDecline({ code: "card_declined", decline_code: "insufficient_funds" })).toBe("Cartão sem limite suficiente.");
    expect(describeStripeDecline({ code: "expired_card" })).toBe("Cartão vencido. Use outro cartão.");
    expect(describeStripeDecline(null)).toMatch(/recusado/);
  });

  it("valida a assinatura do webhook com janela anti-replay", () => {
    const payload = '{"id":"evt_1"}';
    const now = 1_800_000_000;
    const header = sign(payload, now);
    expect(verifyStripeSignature({ payload, header, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(true);
    expect(verifyStripeSignature({ payload: payload + " ", header, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature({ payload, header, secret: "whsec_outro", nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature({ payload, header, secret: WEBHOOK_SECRET, nowSeconds: now + 301 })).toBe(false);
    expect(verifyStripeSignature({ payload, header: `t=${now},v1=${"0".repeat(64)},${header.split(",")[1]}`, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(true);
    expect(verifyStripeSignature({ payload, header: null, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(false);
    expect(verifyStripeSignature({ payload, header: "lixo", secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(false);
  });
});

describe("Stripe — configuração", () => {
  it("detecta modo de teste e só oferece cartão com chave publicável do mesmo modo", () => {
    expect(gateway().isSandbox).toBe(true);
    expect(gateway().supportsMethods).toEqual(["PIX", "CREDIT_CARD"]);
    expect(gateway({ publishableKey: "pk_live_123" }).supportsMethods).toEqual(["PIX"]);
    expect(gateway({ publishableKey: null }).publicKey).toBeNull();
    expect(gateway({ pixEnabled: false }).supportsMethods).toEqual(["CREDIT_CARD"]);
    const live = gateway({ secretKey: "sk_live_999", publishableKey: "pk_live_999" });
    expect(live.isSandbox).toBe(false);
    expect(live.supportsMethods).toEqual(["PIX", "CREDIT_CARD"]);
    expect(() => gateway({ secretKey: "" })).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => gateway({ secretKey: "pk_test_123" })).toThrow(/STRIPE_SECRET_KEY/);
  });
});

describe("Stripe — pagamentos", () => {
  it("cria PIX com expiração da reserva e gera o QR localmente", async () => {
    const calls = mockFetch([{ body: intent({ next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: "00020101021226...6304ABCD", expires_at: 1_791_216_000 } } }) }]);
    const result = await gateway().createPayment({ ...baseInput, method: "PIX" });
    expect(result.status).toBe("PENDING");
    expect(result.providerPaymentId).toBe("pi_3Abc123456");
    expect(result.isSandbox).toBe(true);
    expect(result.pix?.qrCode).toBe("00020101021226...6304ABCD");
    expect(result.pix?.qrCodeImageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.pix?.expiresAt.getTime()).toBe(1_791_216_000_000);

    const [call] = calls;
    expect(call?.url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(call?.headers["Stripe-Version"]).toBe(STRIPE_API_VERSION);
    expect(call?.headers["Idempotency-Key"]).toBe("chave-1");
    expect(call?.headers.Authorization).toBe("Bearer sk_test_123");
    expect(call?.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(call?.body);
    expect(body.get("amount")).toBe("12990");
    expect(body.get("currency")).toBe("brl");
    expect(body.get("payment_method_types[0]")).toBe("pix");
    expect(body.get("payment_method_data[type]")).toBe("pix");
    expect(body.get("payment_method_options[pix][expires_at]")).toBe(String(Math.floor(baseInput.expiresAt.getTime() / 1000)));
    expect(body.get("metadata[payment_id]")).toBe("pay_1");
    expect(body.get("confirm")).toBe("true");
  });

  it("cartão à vista aprovado devolve bandeira e final", async () => {
    const calls = mockFetch([{ body: intent({ status: "succeeded", amount_received: 12990, payment_method: { id: "pm_1Abcdef", card: { brand: "visa", last4: "4242" } } }) }]);
    const result = await gateway().createPayment({ ...baseInput, method: "CREDIT_CARD", cardToken: "pm_1Abcdef" });
    expect(result).toMatchObject({ status: "PAID", card: { brand: "visa", last4: "4242" }, failureReason: null });
    const body = new URLSearchParams(calls[0]?.body);
    expect(body.get("payment_method")).toBe("pm_1Abcdef");
    expect(body.get("use_stripe_sdk")).toBe("true");
    expect(body.get("payment_method_types[0]")).toBe("card");
  });

  it("recusa do cartão (HTTP 402) vira FAILED com motivo, sem lançar", async () => {
    mockFetch([
      {
        status: 402,
        body: { error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds", payment_intent: intent({ status: "requires_payment_method", last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" } }) } },
      },
    ]);
    const result = await gateway().createPayment({ ...baseInput, method: "CREDIT_CARD", cardToken: "pm_1Abcdef" });
    expect(result.status).toBe("FAILED");
    expect(result.providerPaymentId).toBe("pi_3Abc123456");
    expect(result.failureReason).toBe("Cartão sem limite suficiente.");
  });

  it("rejeita token que não é um PaymentMethod", async () => {
    await expect(gateway().createPayment({ ...baseInput, method: "CREDIT_CARD", cardToken: "4111111111111111" })).rejects.toThrow(/cartão/i);
  });

  it("parcelado: confirma com o plano disponível para o cartão", async () => {
    const plans = { card: { installments: { enabled: true, available_plans: [{ count: 2, interval: "month", type: "fixed_count" }, { count: 3, interval: "month", type: "fixed_count" }] } } };
    const calls = mockFetch([{ body: intent({ status: "requires_confirmation", payment_method_options: plans }) }, { body: intent({ status: "succeeded", amount_received: 12990 }) }]);
    const result = await gateway().createPayment({ ...baseInput, method: "CREDIT_CARD", cardToken: "pm_1Abcdef", installments: 3 });
    expect(result.status).toBe("PAID");
    expect(new URLSearchParams(calls[0]?.body).get("payment_method_options[card][installments][enabled]")).toBe("true");
    expect(new URLSearchParams(calls[0]?.body).get("confirm")).toBeNull();
    expect(calls[1]?.url).toBe("https://api.stripe.com/v1/payment_intents/pi_3Abc123456/confirm");
    expect(calls[1]?.headers["Idempotency-Key"]).toBe("chave-1:confirm");
    const confirm = new URLSearchParams(calls[1]?.body);
    expect(confirm.get("payment_method_options[card][installments][plan][count]")).toBe("3");
    expect(confirm.get("payment_method_options[card][installments][plan][type]")).toBe("fixed_count");
    expect(confirm.get("payment_method_options[card][installments][plan][interval]")).toBe("month");
  });

  it("parcelado: cartão sem o plano pedido é recusado com mensagem clara e o intent é cancelado", async () => {
    const plans = { card: { installments: { enabled: true, available_plans: [{ count: 2, interval: "month", type: "fixed_count" }] } } };
    const calls = mockFetch([{ body: intent({ status: "requires_confirmation", payment_method_options: plans }) }, { body: intent({ status: "canceled" }) }]);
    const result = await gateway().createPayment({ ...baseInput, method: "CREDIT_CARD", cardToken: "pm_1Abcdef", installments: 6 });
    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toMatch(/6x/);
    expect(calls[1]?.url).toBe("https://api.stripe.com/v1/payment_intents/pi_3Abc123456/cancel");
  });

  it("autenticação 3DS pendente expõe o client_secret só via getClientAction", async () => {
    mockFetch([{ body: intent({ status: "requires_action", client_secret: "pi_3Abc123456_secret_x", next_action: { type: "use_stripe_sdk" } }) }]);
    await expect(gateway().getClientAction("pi_3Abc123456")).resolves.toEqual({ type: "stripe_sdk", clientSecret: "pi_3Abc123456_secret_x" });
  });

  it("reembolso usa o PaymentIntent e a chave idempotente", async () => {
    const calls = mockFetch([{ body: { id: "re_123", status: "succeeded" } }]);
    await expect(gateway().refund("pi_3Abc123456", 5000, "refund:o1:5000")).resolves.toEqual({ providerRefundId: "re_123", status: "SUCCEEDED" });
    const body = new URLSearchParams(calls[0]?.body);
    expect(body.get("payment_intent")).toBe("pi_3Abc123456");
    expect(body.get("amount")).toBe("5000");
    expect(calls[0]?.headers["Idempotency-Key"]).toBe("refund:o1:5000");
  });
});

describe("Stripe — webhook", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const request = (payload: string, header: string | null) => ({ headers: new Headers(header ? { "stripe-signature": header } : {}), rawBody: payload, url: "https://loja.example/api/webhooks/payments/stripe" });

  it("evento assinado: status vem da API, não do corpo", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", livemode: false, data: { object: { id: "pi_3Abc123456", object: "payment_intent", status: "succeeded" } } });
    const calls = mockFetch([{ body: intent({ status: "succeeded", amount_received: 12990, latest_charge: { id: "ch_1", amount_refunded: 0 } }) }]);
    const result = await gateway().verifyWebhook(request(payload, sign(payload, now())));
    expect(result).toMatchObject({ ok: true, providerPaymentId: "pi_3Abc123456", status: "PAID", paidAmountCents: 12990, eventId: "pi_3Abc123456:PAID", externalReference: "pay_1" });
    expect(calls[0]?.url).toBe("https://api.stripe.com/v1/payment_intents/pi_3Abc123456?expand[0]=latest_charge");
  });

  it("reembolso feito no painel chega como charge.refunded", async () => {
    const payload = JSON.stringify({ id: "evt_2", type: "charge.refunded", data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_3Abc123456" } } });
    mockFetch([{ body: intent({ status: "succeeded", amount_received: 12990, latest_charge: { id: "ch_1", amount_refunded: 12990 } }) }]);
    const result = await gateway().verifyWebhook(request(payload, sign(payload, now())));
    expect(result).toMatchObject({ ok: true, status: "REFUNDED" });
  });

  it("assinatura inválida é recusada sem consultar a API; eventos sem pagamento são ignorados", async () => {
    const payload = JSON.stringify({ id: "evt_3", type: "customer.created", data: { object: { id: "cus_1", object: "customer" } } });
    mockFetch([]);
    await expect(gateway().verifyWebhook(request(payload, sign(payload, now(), "whsec_errado")))).resolves.toMatchObject({ ok: false });
    await expect(gateway().verifyWebhook(request(payload, null))).resolves.toMatchObject({ ok: false });
    await expect(gateway().verifyWebhook(request(payload, sign(payload, now())))).resolves.toMatchObject({ ok: false, ignorable: true });
  });
});
