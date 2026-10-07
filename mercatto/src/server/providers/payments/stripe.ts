import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { logger } from "@/server/observability/logger";
import { ProviderConfigurationError, ProviderError, isProviderError } from "@/server/providers/errors";
import { formatBRL } from "@/lib/money";
import { providerRequest } from "@/server/providers/http";
import type {
  ClientPaymentAction,
  CreatePaymentInput,
  CreatePaymentResult,
  GatewayPaymentStatus,
  PaymentGateway,
  PaymentMethodCode,
  RefundResult,
  WebhookVerification,
} from "@/server/providers/payments/types";

/**
 * STRIPE — integração real via API REST (PaymentIntents), em reais (BRL).
 *
 *  - PIX:     POST /v1/payment_intents (payment_method_types=[pix], confirm=true);
 *             o código "copia e cola" vem em next_action.pix_display_qr_code.data
 *             e o QR é gerado aqui (sem carregar imagens de terceiros).
 *  - Cartão:  o navegador cria um PaymentMethod (pm_...) com o Payment Element
 *             (o número do cartão nunca passa pela Mercatto) e o servidor
 *             confirma o PaymentIntent com use_stripe_sdk=true. Se o banco exigir
 *             3D Secure, o status fica pendente e a página de pagamento conclui
 *             a autenticação com stripe.handleNextAction (getClientAction).
 *  - Parcelas: parcelamento brasileiro da Stripe (o comprador paga o mesmo total;
 *             a tarifa fica com a loja). O plano só é escolhido na confirmação,
 *             depois de consultar os planos disponíveis para o cartão.
 *  - Webhook: cabeçalho `Stripe-Signature: t=<unix>,v1=<hmac>` = HMAC-SHA256 de
 *             "<t>.<corpo bruto>" com a chave secreta do endpoint (whsec_...),
 *             tolerância de 5 minutos. O status NUNCA é lido do corpo: o
 *             PaymentIntent é sempre consultado na API (fonte da verdade).
 *
 * Valores na Stripe já são em centavos (menor unidade da moeda).
 * A versão da API é fixada (Stripe-Version) para o formato das respostas não
 * mudar quando a conta for atualizada no painel.
 * Credenciais de teste (sk_test_/pk_test_) => isSandbox (faixa "demonstração").
 */

export const STRIPE_PROVIDER = "stripe";
export const STRIPE_API_VERSION = "2025-08-27.basil";
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const API_BASE = "https://api.stripe.com";
const REQUEST_TIMEOUT_MS = 20_000;
const UNAVAILABLE_MESSAGE = "Não foi possível falar com o processador de pagamentos. Tente novamente em instantes.";
const REJECTED_MESSAGE = "O pagamento não foi aceito pelo processador. Revise os dados e tente novamente.";

// ---------------------------------------------------------------------------
// Funções puras (exportadas para testes)
// ---------------------------------------------------------------------------

/**
 * Codifica parâmetros no formato aceito pela API da Stripe
 * (`a[b][0]=c`, application/x-www-form-urlencoded). Ignora null/undefined.
 */
export function encodeStripeForm(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${key}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${key}[${k}]`);
      return;
    }
    out.append(key, String(value));
  };
  for (const [k, v] of Object.entries(params)) walk(v, k);
  return out.toString().replace(/%5B/g, "[").replace(/%5D/g, "]");
}

type StatusInput = {
  status: string;
  amount: number;
  amount_received?: number | null;
  cancellation_reason?: string | null;
  last_payment_error?: { code?: string | null } | null;
  latest_charge?: string | { amount_refunded?: number | null } | null;
};

/**
 * Status do PaymentIntent -> status interno. Desconhecido => PENDING (nunca
 * confirma pagamento por engano). Reembolsos são lidos da última cobrança
 * (latest_charge expandida).
 */
export function mapStripeStatus(pi: StatusInput): GatewayPaymentStatus {
  switch (pi.status) {
    case "succeeded": {
      const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      const refunded = charge?.amount_refunded ?? 0;
      const received = pi.amount_received || pi.amount;
      if (refunded > 0) return refunded >= received ? "REFUNDED" : "PARTIALLY_REFUNDED";
      return "PAID";
    }
    case "requires_capture":
      return "AUTHORIZED";
    case "processing":
    case "requires_action":
    case "requires_confirmation":
      return "PENDING";
    case "requires_payment_method":
      // Sem erro: ainda não houve tentativa. Com erro: recusa ou PIX vencido.
      if (!pi.last_payment_error) return "PENDING";
      return pi.last_payment_error.code === "payment_intent_payment_attempt_expired" ? "EXPIRED" : "FAILED";
    case "canceled":
      return pi.cancellation_reason === "expired" ? "EXPIRED" : "CANCELLED";
    default:
      logger.warn("payments.stripe.unknown_status", { status: pi.status });
      return "PENDING";
  }
}

const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds: "Cartão sem limite suficiente.",
  expired_card: "Cartão vencido. Use outro cartão.",
  incorrect_cvc: "Código de segurança inválido.",
  invalid_cvc: "Código de segurança inválido.",
  incorrect_number: "Número do cartão inválido.",
  invalid_number: "Número do cartão inválido.",
  invalid_expiry_month: "Data de validade inválida.",
  invalid_expiry_year: "Data de validade inválida.",
  card_velocity_exceeded: "Limite de tentativas do cartão atingido. Use outro cartão.",
  lost_card: "Cartão recusado. Use outro meio de pagamento.",
  stolen_card: "Cartão recusado. Use outro meio de pagamento.",
  pickup_card: "Cartão recusado. Use outro meio de pagamento.",
  fraudulent: "Pagamento recusado pela análise de segurança. Use outro meio de pagamento.",
  merchant_blacklist: "Pagamento recusado pela análise de segurança. Use outro meio de pagamento.",
  card_not_supported: "Este cartão não aceita este tipo de compra. Use outro cartão.",
  currency_not_supported: "Este cartão não aceita compras em reais. Use outro cartão.",
  authentication_required: "O banco exige confirmação da compra. Tente novamente e confirme no app do banco.",
  payment_intent_authentication_failure: "A confirmação no banco não foi concluída. Tente novamente.",
  processing_error: "Erro ao processar o cartão. Tente novamente em instantes.",
  try_again_later: "O emissor do cartão está indisponível. Tente novamente em instantes.",
  payment_intent_payment_attempt_expired: "O prazo para pagamento terminou.",
  do_not_honor: "Cartão recusado pelo emissor.",
  generic_decline: "Cartão recusado pelo emissor.",
  card_declined: "Cartão recusado pelo emissor.",
};

export function describeStripeDecline(error: { code?: string | null; decline_code?: string | null } | null | undefined): string {
  return (error?.decline_code && DECLINE_MESSAGES[error.decline_code]) || (error?.code && DECLINE_MESSAGES[error.code]) || "Pagamento recusado. Tente outro meio de pagamento.";
}

export function mapStripeRefundStatus(status: string | null | undefined): RefundResult["status"] {
  if (status === "succeeded") return "SUCCEEDED";
  if (status === "failed" || status === "canceled") return "FAILED";
  return "PENDING";
}

export function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && value && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === "v1" && value && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  return timestamp !== null && signatures.length ? { timestamp, signatures } : null;
}

/** Verificação constante no tempo, com janela anti-replay. */
export function verifyStripeSignature(input: { payload: string; header: string | null; secret: string; nowSeconds?: number; toleranceSeconds?: number }): boolean {
  if (!input.header) return false;
  const parsed = parseStripeSignature(input.header);
  if (!parsed) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > (input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS)) return false;
  const expected = createHmac("sha256", input.secret).update(`${parsed.timestamp}.${input.payload}`, "utf8").digest();
  return parsed.signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

// ---------------------------------------------------------------------------
// Respostas da API (somente os campos usados; o restante é descartado)
// ---------------------------------------------------------------------------

const cardSchema = z.object({ brand: z.string().nullish(), last4: z.string().nullish() }).nullish();

const chargeSchema = z.object({
  id: z.string(),
  amount_refunded: z.number().int().nullish(),
  payment_method_details: z.object({ card: cardSchema }).nullish(),
});

const paymentIntentSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int(),
  amount_received: z.number().int().nullish(),
  currency: z.string().nullish(),
  livemode: z.boolean().nullish(),
  client_secret: z.string().nullish(),
  cancellation_reason: z.string().nullish(),
  payment_method_types: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
  last_payment_error: z.object({ code: z.string().nullish(), decline_code: z.string().nullish(), type: z.string().nullish() }).nullish(),
  latest_charge: z.union([z.string(), chargeSchema]).nullish(),
  payment_method: z.union([z.string(), z.object({ id: z.string(), card: cardSchema })]).nullish(),
  next_action: z
    .object({
      type: z.string().nullish(),
      pix_display_qr_code: z.object({ data: z.string().nullish(), expires_at: z.number().nullish(), hosted_instructions_url: z.string().nullish() }).nullish(),
    })
    .nullish(),
  payment_method_options: z
    .object({
      card: z
        .object({
          installments: z
            .object({ available_plans: z.array(z.object({ count: z.number().int().nullish(), interval: z.string().nullish(), type: z.string().nullish() })).nullish() })
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
});
type StripePaymentIntent = z.infer<typeof paymentIntentSchema>;

/** Corpo de erro de cartão (HTTP 402): traz o PaymentIntent recusado. */
const cardErrorSchema = z.object({
  error: z.object({
    type: z.string().nullish(),
    code: z.string().nullish(),
    decline_code: z.string().nullish(),
    payment_intent: paymentIntentSchema.nullish(),
    payment_method: z.object({ card: cardSchema }).nullish(),
  }),
});

const refundSchema = z.object({ id: z.string(), status: z.string().nullish() });

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  livemode: z.boolean().nullish(),
  data: z.object({
    object: z.object({ id: z.string().nullish(), object: z.string().nullish(), payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullish() }).passthrough(),
  }),
});

const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]{6,100}$/;
const PAYMENT_METHOD_ID = /^pm_[A-Za-z0-9]{6,100}$/;

function assertPaymentIntentId(id: string) {
  if (!PAYMENT_INTENT_ID.test(id)) {
    throw new ProviderError({ provider: STRIPE_PROVIDER, kind: "http", code: "NOT_FOUND", httpStatus: 404, userMessage: "Pagamento não encontrado na Stripe.", retryable: false });
  }
}

function invalidResponse(detail: string): ProviderError {
  logger.error("payments.stripe.invalid_response", { detail });
  return new ProviderError({ provider: STRIPE_PROVIDER, kind: "invalid_response", code: "PAYMENT_FAILED", userMessage: UNAVAILABLE_MESSAGE });
}

function rejected(userMessage: string, cause?: unknown): ProviderError {
  return new ProviderError({ provider: STRIPE_PROVIDER, kind: "rejected", code: "PAYMENT_FAILED", userMessage, retryable: false, cause });
}

function cardOf(pi: StripePaymentIntent): { brand: string | null; last4: string | null } | null {
  const fromMethod = typeof pi.payment_method === "object" ? pi.payment_method?.card : null;
  const fromCharge = typeof pi.latest_charge === "object" ? pi.latest_charge?.payment_method_details?.card : null;
  const card = fromMethod ?? fromCharge;
  return card ? { brand: card.brand ?? null, last4: card.last4 ?? null } : null;
}

export type StripeConfig = {
  secretKey: string;
  publishableKey?: string | null;
  webhookSecret?: string | null;
  /** false desativa o PIX (ex.: conta sem PIX habilitado). */
  pixEnabled?: boolean;
  /** Base da API (substituível em testes). */
  apiBase?: string;
};

export class StripeGateway implements PaymentGateway {
  readonly name = STRIPE_PROVIDER;
  readonly isSandbox: boolean;
readonly supportsMethods: PaymentMethodCode[];
  /** A Stripe recusa cobranças em BRL abaixo de R$ 0,50 (amount_too_small). */
  readonly minAmountCents = 50;
  readonly publicKey: string | null;

  private readonly secretKey: string;
  private readonly webhookSecret: string | null;
  private readonly apiBase: string;

  constructor(config: StripeConfig) {
    const secretKey = config.secretKey.trim();
    if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
      throw new ProviderConfigurationError(STRIPE_PROVIDER, "PAYMENT_PROVIDER=stripe requer STRIPE_SECRET_KEY (sk_test_... ou sk_live_...) — Painel da Stripe > Desenvolvedores > Chaves de API.");
    }
    this.secretKey = secretKey;
    this.isSandbox = /^(sk|rk)_test_/.test(secretKey);
    this.webhookSecret = config.webhookSecret?.trim() || null;
    this.apiBase = config.apiBase ?? API_BASE;

    // O cartão só é oferecido com a chave publicável do MESMO modo (teste/produção):
    // um PaymentMethod criado em teste não existe na conta de produção.
    const publishable = config.publishableKey?.trim() || null;
    const expectedPrefix = this.isSandbox ? "pk_test_" : "pk_live_";
    this.publicKey = publishable?.startsWith(expectedPrefix) ? publishable : null;
    if (!this.publicKey) {
      logger.error("payments.stripe.card_disabled", { reason: publishable ? "STRIPE_PUBLISHABLE_KEY de outro modo (teste x produção)" : "STRIPE_PUBLISHABLE_KEY ausente" });
    }
    this.supportsMethods = [...(config.pixEnabled === false ? [] : (["PIX"] as const)), ...(this.publicKey ? (["CREDIT_CARD"] as const) : [])];
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    };
  }

  private async fetchPaymentIntent(id: string, expand: string[] = ["latest_charge"]): Promise<StripePaymentIntent> {
    assertPaymentIntentId(id);
    const query = expand.map((e, i) => `expand[${i}]=${encodeURIComponent(e)}`).join("&");
    const { data } = await providerRequest<unknown>({
      provider: STRIPE_PROVIDER,
      url: `${this.apiBase}/v1/payment_intents/${id}${query ? `?${query}` : ""}`,
      method: "GET",
      headers: this.headers(),
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: UNAVAILABLE_MESSAGE,
      errorCode: "PAYMENT_FAILED",
    });
    const parsed = paymentIntentSchema.safeParse(data);
    if (!parsed.success) throw invalidResponse("payment_intent schema mismatch");
    return parsed.data;
  }

  /**
   * POST que aceita a recusa de cartão (HTTP 402) como resultado: devolve o
   * PaymentIntent recusado em vez de lançar. Outros 4xx => pagamento recusado.
   */
  private async postIntent(path: string, params: Record<string, unknown>, idempotencyKey: string): Promise<{ pi: StripePaymentIntent; declined: { code: string | null; decline_code: string | null; card: { brand: string | null; last4: string | null } | null } | null }> {
    let response: { status: number; data: unknown };
    try {
      response = await providerRequest<unknown>({
        provider: STRIPE_PROVIDER,
        url: `${this.apiBase}${path}`,
        method: "POST",
        headers: this.headers(idempotencyKey),
        form: encodeStripeForm(params),
        timeoutMs: REQUEST_TIMEOUT_MS,
        userMessage: UNAVAILABLE_MESSAGE,
        errorCode: "PAYMENT_FAILED",
        acceptStatuses: [402],
      });
    } catch (error) {
      // 4xx = dados recusados (método inativo na conta, token inválido...). Repetir não resolve.
      if (isProviderError(error) && error.kind === "http") throw rejected(REJECTED_MESSAGE, error);
      throw error;
    }
    if (response.status === 402) {
      const parsed = cardErrorSchema.safeParse(response.data);
      const pi = parsed.success ? parsed.data.error.payment_intent : null;
      if (!parsed.success || !pi) throw rejected(parsed.success ? describeStripeDecline(parsed.data.error) : REJECTED_MESSAGE);
      const card = parsed.data.error.payment_method?.card;
      return {
        pi,
        declined: { code: parsed.data.error.code ?? null, decline_code: parsed.data.error.decline_code ?? null, card: card ? { brand: card.brand ?? null, last4: card.last4 ?? null } : null },
      };
    }
    const parsed = paymentIntentSchema.safeParse(response.data);
    if (!parsed.success) throw invalidResponse("create payment_intent schema mismatch");
    return { pi: parsed.data, declined: null };
  }

  private toResult(pi: StripePaymentIntent, declined: { code: string | null; decline_code: string | null; card: { brand: string | null; last4: string | null } | null } | null, method: PaymentMethodCode): CreatePaymentResult {
    const status = mapStripeStatus(pi);
    return {
      providerPaymentId: pi.id,
      status,
      failureReason: status === "FAILED" ? describeStripeDecline(declined ?? pi.last_payment_error) : null,
      isSandbox: this.isSandbox || pi.livemode === false,
      ...(method === "CREDIT_CARD" ? { card: declined?.card ?? cardOf(pi) ?? { brand: null, last4: null } } : {}),
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw rejected("Valor do pagamento inválido.");
    if (input.amountCents < this.minAmountCents) throw rejected(`O valor mínimo para pagamento é ${formatBRL(this.minAmountCents)}.`);
    if (!this.supportsMethods.includes(input.method)) throw rejected("Forma de pagamento indisponível.");
    const common = {
      amount: input.amountCents,
      currency: "brl",
      description: input.description.slice(0, 250),
      metadata: { payment_id: input.paymentId },
    };

    if (input.method === "PIX") {
      const { pi } = await this.postIntent(
        "/v1/payment_intents",
        {
          ...common,
          payment_method_types: ["pix"],
          payment_method_data: { type: "pix", billing_details: { name: input.payer.name.slice(0, 100), email: input.payer.email } },
          payment_method_options: { pix: { expires_at: Math.floor(input.expiresAt.getTime() / 1000) } },
          confirm: true,
        },
        input.idempotencyKey,
      );
      const result = this.toResult(pi, null, "PIX");
      if (result.status === "PENDING") {
        const qr = pi.next_action?.pix_display_qr_code;
        if (!qr?.data) throw invalidResponse("pix_display_qr_code ausente");
        result.pix = {
          qrCode: qr.data,
          qrCodeImageDataUrl: await QRCode.toDataURL(qr.data, { errorCorrectionLevel: "M", margin: 1, width: 320 }),
          expiresAt: qr.expires_at ? new Date(qr.expires_at * 1000) : input.expiresAt,
        };
      }
      logger.info("payments.stripe.created", { paymentId: input.paymentId, providerPaymentId: pi.id, method: "PIX", status: result.status });
      return result;
    }

    const token = input.cardToken?.trim() ?? "";
    if (!PAYMENT_METHOD_ID.test(token)) throw rejected("Dados do cartão ausentes. Preencha o cartão novamente.");
    const card = { ...common, payment_method_types: ["card"], payment_method: token, expand: ["payment_method"] };

    let outcome: Awaited<ReturnType<StripeGateway["postIntent"]>>;
    if (input.installments <= 1) {
      outcome = await this.postIntent("/v1/payment_intents", { ...card, confirm: true, use_stripe_sdk: true }, input.idempotencyKey);
    } else {
      // Parcelado: cria sem confirmar para conhecer os planos aceitos pelo cartão.
      const created = await this.postIntent("/v1/payment_intents", { ...card, payment_method_options: { card: { installments: { enabled: true } } } }, input.idempotencyKey);
      const plans = created.pi.payment_method_options?.card?.installments?.available_plans ?? [];
      const plan = plans.find((p) => p.type === "fixed_count" && p.count === input.installments && (p.interval ?? "month") === "month");
      if (created.declined || created.pi.status !== "requires_confirmation") {
        outcome = created;
      } else if (!plan) {
        await this.cancelPayment(created.pi.id).catch(() => undefined);
        logger.info("payments.stripe.installments_unavailable", { paymentId: input.paymentId, requested: input.installments, available: plans.map((p) => p.count) });
        return {
          providerPaymentId: created.pi.id,
          status: "FAILED",
          failureReason: `Este cartão não permite parcelar em ${input.installments}x. Escolha outra opção de parcelamento ou pague à vista.`,
          card: cardOf(created.pi) ?? { brand: null, last4: null },
          isSandbox: this.isSandbox,
        };
      } else {
        outcome = await this.postIntent(
          `/v1/payment_intents/${created.pi.id}/confirm`,
          { payment_method_options: { card: { installments: { plan: { type: "fixed_count", count: input.installments, interval: "month" } } } }, use_stripe_sdk: true, expand: ["payment_method"] },
          `${input.idempotencyKey}:confirm`,
        );
      }
    }
    const result = this.toResult(outcome.pi, outcome.declined, "CREDIT_CARD");
    logger.info("payments.stripe.created", {
      paymentId: input.paymentId,
      providerPaymentId: outcome.pi.id,
      method: "CREDIT_CARD",
      status: result.status,
      intentStatus: outcome.pi.status,
      declineCode: outcome.declined?.decline_code ?? outcome.declined?.code ?? null,
    });
    return result;
  }

  async getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentStatus> {
    return mapStripeStatus(await this.fetchPaymentIntent(providerPaymentId));
  }

  async cancelPayment(providerPaymentId: string): Promise<void> {
    assertPaymentIntentId(providerPaymentId);
    await providerRequest({
      provider: STRIPE_PROVIDER,
      url: `${this.apiBase}/v1/payment_intents/${providerPaymentId}/cancel`,
      method: "POST",
      headers: this.headers(),
      form: "",
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: "Não foi possível cancelar o pagamento na Stripe.",
      errorCode: "PAYMENT_FAILED",
    });
    logger.info("payments.stripe.cancelled", { providerPaymentId });
  }

  async refund(providerPaymentId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult> {
    assertPaymentIntentId(providerPaymentId);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new ProviderError({ provider: STRIPE_PROVIDER, kind: "rejected", code: "BAD_REQUEST", userMessage: "Valor de reembolso inválido.", retryable: false });
    }
    const { data } = await providerRequest<unknown>({
      provider: STRIPE_PROVIDER,
      url: `${this.apiBase}/v1/refunds`,
      method: "POST",
      headers: this.headers(idempotencyKey),
      form: encodeStripeForm({ payment_intent: providerPaymentId, amount: amountCents }),
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: "Não foi possível solicitar o reembolso à Stripe. Tente novamente.",
      errorCode: "PAYMENT_FAILED",
    });
    const parsed = refundSchema.safeParse(data);
    if (!parsed.success) throw invalidResponse("refund schema mismatch");
    const status = mapStripeRefundStatus(parsed.data.status);
    logger.info("payments.stripe.refund", { providerPaymentId, amountCents, status });
    return { providerRefundId: parsed.data.id, status };
  }

  /**
   * Ação pendente no navegador: autenticação 3D Secure do cartão ou, somente
   * em modo de teste, a página da Stripe que simula o pagamento do PIX.
   */
  async getClientAction(providerPaymentId: string): Promise<ClientPaymentAction | null> {
    const pi = await this.fetchPaymentIntent(providerPaymentId, []);
    if (pi.status !== "requires_action") return null;
    if (pi.next_action?.type === "use_stripe_sdk" && pi.client_secret) return { type: "stripe_sdk", clientSecret: pi.client_secret };
    const url = pi.next_action?.pix_display_qr_code?.hosted_instructions_url;
    if (this.isSandbox && url?.startsWith("https://")) return { type: "pix_test_page", url };
    return null;
  }

  /**
   * Valida a assinatura e consulta o PaymentIntent na API.
   * - Assinatura ausente/inválida/fora da janela => { ok: false }.
   * - Evento autêntico sem pagamento associado => { ok: false, ignorable: true }.
   * - Falha ao consultar a API => LANÇA (responda 5xx para a Stripe reenviar).
   * eventId = "<id do PaymentIntent>:<status consultado>".
   */
  async verifyWebhook(request: { headers: Headers; rawBody: string; url: string }): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      throw new ProviderConfigurationError(STRIPE_PROVIDER, "STRIPE_WEBHOOK_SECRET não configurado (Painel da Stripe > Desenvolvedores > Webhooks > Segredo de assinatura).");
    }
    if (!verifyStripeSignature({ payload: request.rawBody, header: request.headers.get("stripe-signature"), secret: this.webhookSecret })) {
      return { ok: false, reason: "Assinatura inválida." };
    }

    let json: unknown;
    try {
      json = JSON.parse(request.rawBody);
    } catch {
      return { ok: false, reason: "Corpo do webhook não é JSON válido." };
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) return { ok: false, reason: "Evento com formato inválido." };
    const event = parsed.data;
    const object = event.data.object;
    const related = typeof object.payment_intent === "string" ? object.payment_intent : (object.payment_intent?.id ?? null);
    const paymentIntentId = object.object === "payment_intent" ? (object.id ?? null) : related;
    if (!paymentIntentId || !PAYMENT_INTENT_ID.test(paymentIntentId)) {
      return { ok: false, ignorable: true, reason: `Evento ignorado (${event.type}).` };
    }

    // Fonte da verdade: a API da Stripe (nunca o corpo do evento).
    const pi = await this.fetchPaymentIntent(paymentIntentId);
    const status = mapStripeStatus(pi);
    return {
      ok: true,
      eventId: `${pi.id}:${status}`,
      type: event.type,
      providerPaymentId: pi.id,
      status,
      ...(status === "PAID" ? { paidAmountCents: pi.amount_received ?? pi.amount } : {}),
      externalReference: pi.metadata?.payment_id ?? null,
      raw: {
        event: { id: event.id, type: event.type, livemode: event.livemode ?? null },
        paymentIntent: { id: pi.id, status: pi.status, amount: pi.amount, amountReceived: pi.amount_received ?? null, currency: pi.currency ?? null, paymentId: pi.metadata?.payment_id ?? null },
      },
    };
  }
}
