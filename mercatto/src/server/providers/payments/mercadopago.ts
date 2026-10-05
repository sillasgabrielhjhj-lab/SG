import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { onlyDigits } from "@/lib/format";
import { logger } from "@/server/observability/logger";
import { centsToDecimalNumber, decimalToCents } from "@/server/providers/decimal";
import { ProviderConfigurationError, ProviderError, isProviderError } from "@/server/providers/errors";
import { providerRequest } from "@/server/providers/http";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  GatewayPaymentStatus,
  PaymentGateway,
  PaymentMethodCode,
  RefundResult,
  WebhookVerification,
} from "@/server/providers/payments/types";

/**
 * MERCADO PAGO — integração real via API REST (Checkout Transparente / Pagamentos).
 *
 * Implementado conforme a documentação oficial:
 *  - Criar pagamento:   POST /v1/payments (header X-Idempotency-Key)
 *  - Consultar:         GET  /v1/payments/{id}
 *  - Cancelar:          PUT  /v1/payments/{id} { status: "cancelled" }
 *  - Reembolsar:        POST /v1/payments/{id}/refunds { amount } (X-Idempotency-Key)
 *  - Webhooks:          header `x-signature: ts=<ts>,v1=<hmac>` validado com o
 *                       manifesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 *                       (HMAC-SHA256 com a assinatura secreta do painel).
 *
 * ⚠️ REQUER VALIDAÇÃO EM SANDBOX com credenciais reais (TEST-...) antes de ir
 * para produção: fluxo PIX (QR + expiração), cartão via token do Card Payment
 * Brick (payment_method_id/issuer_id), webhooks assinados e reembolsos.
 *
 * Segurança:
 *  - O status NUNCA é lido do corpo do webhook: após validar a assinatura, o
 *    pagamento é sempre consultado na API (fonte da verdade).
 *  - Nenhum dado do pagador (e-mail/CPF) é registrado em log ou devolvido em `raw`.
 *  - `notification_url` só é enviada quando HTTPS (o Mercado Pago rejeita URLs locais).
 */

export const MERCADOPAGO_PROVIDER = "mercadopago";
const API_BASE = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 15_000;
const UNAVAILABLE_MESSAGE = "Não foi possível falar com o processador de pagamentos. Tente novamente em instantes.";
const REJECTED_MESSAGE = "O pagamento não foi aceito pelo processador. Revise os dados e tente novamente.";

// ---------------------------------------------------------------------------
// Mapeamentos puros (exportados para testes)
// ---------------------------------------------------------------------------

/**
 * Status do Mercado Pago -> status interno.
 * `cancelled` com `status_detail = "expired"` (PIX não pago no prazo) => EXPIRED.
 * `approved` com `status_detail = "partially_refunded"` => PARTIALLY_REFUNDED.
 * Status desconhecido => PENDING (nunca confirma pagamento por engano).
 */
export function mapMercadoPagoStatus(status: string, statusDetail?: string | null): GatewayPaymentStatus {
  switch (status) {
    case "approved":
      return statusDetail === "partially_refunded" ? "PARTIALLY_REFUNDED" : "PAID";
    case "authorized":
      return "AUTHORIZED";
    case "pending":
    case "in_process":
    case "in_mediation":
      return "PENDING";
    case "rejected":
      return "FAILED";
    case "cancelled":
      return statusDetail === "expired" ? "EXPIRED" : "CANCELLED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    default:
      logger.warn("payments.mercadopago.unknown_status", { status, statusDetail });
      return "PENDING";
  }
}

const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Cartão sem limite suficiente.",
  cc_rejected_bad_filled_security_code: "Código de segurança inválido.",
  cc_rejected_bad_filled_date: "Data de validade inválida.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_bad_filled_other: "Revise os dados do cartão.",
  cc_rejected_call_for_authorize: "Autorize o pagamento junto ao emissor do cartão e tente novamente.",
  cc_rejected_card_disabled: "Cartão inativo. Ative-o com o emissor ou use outro cartão.",
  cc_rejected_duplicated_payment: "Pagamento duplicado: você já fez um pagamento com este valor.",
  cc_rejected_high_risk: "Pagamento recusado pela análise de segurança. Use outro meio de pagamento.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Use outro cartão.",
  cc_rejected_invalid_installments: "O cartão não aceita este número de parcelas.",
  cc_rejected_blacklist: "Cartão recusado. Use outro meio de pagamento.",
  cc_rejected_other_reason: "Cartão recusado pelo emissor.",
};

export function describeMercadoPagoRejection(statusDetail: string | null | undefined): string {
  return (statusDetail && REJECTION_MESSAGES[statusDetail]) || "Pagamento recusado. Tente outro meio de pagamento.";
}

export function mapMercadoPagoRefundStatus(status: string | null | undefined): RefundResult["status"] {
  if (status === "approved") return "SUCCEEDED";
  if (status === "rejected" || status === "cancelled") return "FAILED";
  return "PENDING";
}

/** Data no formato aceito pelo MP (`yyyy-MM-ddTHH:mm:ss.SSS-03:00`), mesmo instante. */
export function toMercadoPagoDate(date: Date): string {
  const offsetMinutes = -3 * 60;
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().replace("Z", "-03:00");
}

/** Manifesto assinado pelo MP. Partes ausentes são omitidas (documentação oficial). */
export function buildMercadoPagoManifest(parts: { dataId?: string | null; requestId?: string | null; ts: string }): string {
  let manifest = "";
  if (parts.dataId) {
    const id = /^[a-z0-9]+$/i.test(parts.dataId) ? parts.dataId.toLowerCase() : parts.dataId;
    manifest += `id:${id};`;
  }
  if (parts.requestId) manifest += `request-id:${parts.requestId};`;
  manifest += `ts:${parts.ts};`;
  return manifest;
}

export function parseMercadoPagoSignature(header: string): { ts: string; v1: string } | null {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "ts" && value && /^\d{1,16}$/.test(value)) ts = value;
    if (key === "v1" && value && /^[0-9a-f]{64}$/i.test(value)) v1 = value.toLowerCase();
  }
  return ts && v1 ? { ts, v1 } : null;
}

/** Verificação constante no tempo do HMAC do manifesto. */
export function verifyMercadoPagoSignature(input: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  if (!input.signatureHeader) return false;
  const parsed = parseMercadoPagoSignature(input.signatureHeader);
  if (!parsed) return false;
  const manifest = buildMercadoPagoManifest({ dataId: input.dataId, requestId: input.requestId, ts: parsed.ts });
  const expected = createHmac("sha256", input.secret).update(manifest, "utf8").digest();
  const received = Buffer.from(parsed.v1, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// ---------------------------------------------------------------------------
// Respostas da API (somente os campos necessários; o restante é descartado)
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  external_reference: z.string().nullish(),
  transaction_amount: z.number().nullish(),
  payment_method_id: z.string().nullish(),
  date_of_expiration: z.string().nullish(),
  live_mode: z.boolean().nullish(),
  card: z.object({ last_four_digits: z.string().nullish() }).nullish(),
  point_of_interaction: z
    .object({
      transaction_data: z
        .object({ qr_code: z.string().nullish(), qr_code_base64: z.string().nullish(), ticket_url: z.string().nullish() })
        .nullish(),
    })
    .nullish(),
});
type MercadoPagoPayment = z.infer<typeof paymentSchema>;

const refundSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string().nullish(),
});

const notificationSchema = z.object({
  id: z.union([z.number(), z.string()]).nullish(),
  type: z.string().nullish(),
  action: z.string().nullish(),
  live_mode: z.boolean().nullish(),
  date_created: z.string().nullish(),
  data: z.object({ id: z.union([z.number(), z.string()]).transform(String) }).nullish(),
});

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() ?? fullName.trim();
  return { first: first.slice(0, 60), last: parts.join(" ").slice(0, 60) };
}

function assertProviderPaymentId(id: string) {
  if (!/^\d{1,24}$/.test(id)) {
    throw new ProviderError({
      provider: MERCADOPAGO_PROVIDER,
      kind: "http",
      code: "NOT_FOUND",
      httpStatus: 404,
      userMessage: "Pagamento não encontrado no Mercado Pago.",
      retryable: false,
    });
  }
}

function invalidResponse(detail: string): ProviderError {
  logger.error("payments.mercadopago.invalid_response", { detail });
  return new ProviderError({
    provider: MERCADOPAGO_PROVIDER,
    kind: "invalid_response",
    code: "PAYMENT_FAILED",
    userMessage: UNAVAILABLE_MESSAGE,
  });
}

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret?: string | null;
  /** Base da API (substituível em testes). */
  apiBase?: string;
};

export class MercadoPagoGateway implements PaymentGateway {
  readonly name = MERCADOPAGO_PROVIDER;
  readonly isSandbox: boolean;
  readonly supportsMethods: PaymentMethodCode[] = ["PIX", "CREDIT_CARD"];

  private readonly accessToken: string;
  private readonly webhookSecret: string | null;
  private readonly apiBase: string;

  constructor(config: MercadoPagoConfig) {
    if (!config.accessToken) {
      throw new ProviderConfigurationError(
        MERCADOPAGO_PROVIDER,
        "PAYMENT_PROVIDER=mercadopago requer MERCADOPAGO_ACCESS_TOKEN (Painel do desenvolvedor > Suas integrações > Credenciais).",
      );
    }
    this.accessToken = config.accessToken;
    this.webhookSecret = config.webhookSecret || null;
    this.apiBase = config.apiBase ?? API_BASE;
    // Credenciais de teste do Mercado Pago começam com "TEST-".
    this.isSandbox = config.accessToken.startsWith("TEST-");
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, ...extra };
  }

  private async fetchPayment(providerPaymentId: string): Promise<MercadoPagoPayment> {
    assertProviderPaymentId(providerPaymentId);
    const { data } = await providerRequest<unknown>({
      provider: MERCADOPAGO_PROVIDER,
      url: `${this.apiBase}/v1/payments/${providerPaymentId}`,
      method: "GET",
      headers: this.authHeaders(),
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: UNAVAILABLE_MESSAGE,
      errorCode: "PAYMENT_FAILED",
    });
    const parsed = paymentSchema.safeParse(data);
    if (!parsed.success) throw invalidResponse("payment schema mismatch");
    return parsed.data;
  }

  buildCreatePaymentBody(input: CreatePaymentInput): Record<string, unknown> {
    const { first, last } = splitName(input.payer.name);
    const body: Record<string, unknown> = {
      transaction_amount: centsToDecimalNumber(input.amountCents),
      description: input.description.slice(0, 250),
      external_reference: input.paymentId,
      statement_descriptor: "MERCATTO",
      payer: {
        email: input.payer.email,
        first_name: first,
        ...(last ? { last_name: last } : {}),
        identification: { type: "CPF", number: onlyDigits(input.payer.cpf) },
      },
      metadata: { payment_id: input.paymentId },
    };
    if (input.notificationUrl.startsWith("https://")) body.notification_url = input.notificationUrl;

    if (input.method === "PIX") {
      body.payment_method_id = "pix";
      body.date_of_expiration = toMercadoPagoDate(input.expiresAt);
    } else {
      body.token = input.cardToken;
      body.installments = input.installments;
      if (input.paymentMethodId) body.payment_method_id = input.paymentMethodId;
      if (input.issuerId) body.issuer_id = /^\d+$/.test(input.issuerId) ? Number(input.issuerId) : input.issuerId;
    }
    return body;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ProviderError({
        provider: MERCADOPAGO_PROVIDER,
        kind: "rejected",
        code: "PAYMENT_FAILED",
        userMessage: "Valor do pagamento inválido.",
        retryable: false,
      });
    }
    if (input.method === "CREDIT_CARD" && !input.cardToken) {
      throw new ProviderError({
        provider: MERCADOPAGO_PROVIDER,
        kind: "rejected",
        code: "PAYMENT_FAILED",
        userMessage: "Dados do cartão ausentes. Preencha o cartão novamente.",
        retryable: false,
      });
    }

    let data: unknown;
    try {
      ({ data } = await providerRequest<unknown>({
        provider: MERCADOPAGO_PROVIDER,
        url: `${this.apiBase}/v1/payments`,
        method: "POST",
        headers: this.authHeaders({ "X-Idempotency-Key": input.idempotencyKey }),
        json: this.buildCreatePaymentBody(input),
        timeoutMs: REQUEST_TIMEOUT_MS,
        userMessage: UNAVAILABLE_MESSAGE,
        errorCode: "PAYMENT_FAILED",
      }));
    } catch (error) {
      // 4xx = dados recusados (token inválido, CPF inválido...). Repetir não resolve.
      if (isProviderError(error) && error.kind === "http") {
        throw new ProviderError({
          provider: MERCADOPAGO_PROVIDER,
          kind: "rejected",
          code: "PAYMENT_FAILED",
          httpStatus: error.httpStatus,
          userMessage: REJECTED_MESSAGE,
          retryable: false,
          cause: error,
        });
      }
      throw error;
    }

    const parsed = paymentSchema.safeParse(data);
    if (!parsed.success) throw invalidResponse("create payment schema mismatch");
    const payment = parsed.data;
    const status = mapMercadoPagoStatus(payment.status, payment.status_detail);

    const result: CreatePaymentResult = {
      providerPaymentId: payment.id,
      status,
      failureReason: status === "FAILED" ? describeMercadoPagoRejection(payment.status_detail) : null,
      isSandbox: this.isSandbox || payment.live_mode === false,
    };

    if (input.method === "PIX" && status !== "FAILED") {
      const tx = payment.point_of_interaction?.transaction_data;
      const base64 = tx?.qr_code_base64?.replace(/\s+/g, "");
      if (!tx?.qr_code || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw invalidResponse("pix transaction_data ausente");
      }
      result.pix = {
        qrCode: tx.qr_code,
        qrCodeImageDataUrl: `data:image/png;base64,${base64}`,
        expiresAt: payment.date_of_expiration ? new Date(payment.date_of_expiration) : input.expiresAt,
      };
    }
    if (input.method === "CREDIT_CARD") {
      result.card = {
        brand: payment.payment_method_id ?? input.cardBrand ?? null,
        last4: payment.card?.last_four_digits ?? input.cardLast4 ?? null,
      };
    }

    logger.info("payments.mercadopago.created", {
      paymentId: input.paymentId,
      providerPaymentId: payment.id,
      method: input.method,
      status,
      statusDetail: payment.status_detail ?? null,
    });
    return result;
  }

  async getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentStatus> {
    const payment = await this.fetchPayment(providerPaymentId);
    return mapMercadoPagoStatus(payment.status, payment.status_detail);
  }

  async cancelPayment(providerPaymentId: string): Promise<void> {
    assertProviderPaymentId(providerPaymentId);
    await providerRequest({
      provider: MERCADOPAGO_PROVIDER,
      url: `${this.apiBase}/v1/payments/${providerPaymentId}`,
      method: "PUT",
      headers: this.authHeaders(),
      json: { status: "cancelled" },
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: "Não foi possível cancelar o pagamento no Mercado Pago.",
      errorCode: "PAYMENT_FAILED",
    });
    logger.info("payments.mercadopago.cancelled", { providerPaymentId });
  }

  async refund(providerPaymentId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult> {
    assertProviderPaymentId(providerPaymentId);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new ProviderError({
        provider: MERCADOPAGO_PROVIDER,
        kind: "rejected",
        code: "BAD_REQUEST",
        userMessage: "Valor de reembolso inválido.",
        retryable: false,
      });
    }
    const { data } = await providerRequest<unknown>({
      provider: MERCADOPAGO_PROVIDER,
      url: `${this.apiBase}/v1/payments/${providerPaymentId}/refunds`,
      method: "POST",
      headers: this.authHeaders({ "X-Idempotency-Key": idempotencyKey }),
      json: { amount: centsToDecimalNumber(amountCents) },
      timeoutMs: REQUEST_TIMEOUT_MS,
      userMessage: "Não foi possível solicitar o reembolso ao Mercado Pago. Tente novamente.",
      errorCode: "PAYMENT_FAILED",
    });
    const parsed = refundSchema.safeParse(data);
    if (!parsed.success) throw invalidResponse("refund schema mismatch");
    const status = mapMercadoPagoRefundStatus(parsed.data.status);
    logger.info("payments.mercadopago.refund", { providerPaymentId, amountCents, status });
    return { providerRefundId: parsed.data.id, status };
  }

  /**
   * Valida a assinatura `x-signature` e consulta o pagamento na API.
   * - Assinatura ausente/inválida => { ok: false }.
   * - Evento autêntico de outro tipo => { ok: false, ignorable: true }.
   * - Falha ao consultar a API => LANÇA (responda 5xx para o MP reenviar).
   * eventId = "<id do pagamento>:<status consultado>": reenvios do mesmo estado
   * são deduplicados; mudanças de estado geram novos eventos.
   */
  async verifyWebhook(request: { headers: Headers; rawBody: string; url: string }): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      throw new ProviderConfigurationError(
        MERCADOPAGO_PROVIDER,
        "MERCADOPAGO_WEBHOOK_SECRET não configurado (Suas integrações > Webhooks > Assinatura secreta).",
      );
    }

    let notification: z.infer<typeof notificationSchema> = {};
    if (request.rawBody.trim()) {
      let json: unknown;
      try {
        json = JSON.parse(request.rawBody);
      } catch {
        return { ok: false, reason: "Corpo do webhook não é JSON válido." };
      }
      const parsed = notificationSchema.safeParse(json);
      if (!parsed.success) return { ok: false, reason: "Notificação com formato inválido." };
      notification = parsed.data;
    }

    let query: URLSearchParams;
    try {
      query = new URL(request.url).searchParams;
    } catch {
      return { ok: false, reason: "URL do webhook inválida." };
    }
    const queryDataId = query.get("data.id");
    const bodyDataId = notification.data?.id ?? null;
    if (queryDataId && bodyDataId && queryDataId !== bodyDataId) {
      return { ok: false, reason: "data.id divergente entre URL e corpo." };
    }
    const dataId = queryDataId ?? bodyDataId;
    if (!dataId) return { ok: false, reason: "data.id ausente." };

    const valid = verifyMercadoPagoSignature({
      secret: this.webhookSecret,
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
    });
    if (!valid) return { ok: false, reason: "Assinatura inválida." };

    const type = query.get("type") ?? notification.type ?? null;
    if (type !== "payment") {
      return { ok: false, ignorable: true, reason: `Evento ignorado (tipo ${type ?? "desconhecido"}).` };
    }
    if (!/^\d{1,24}$/.test(dataId)) return { ok: false, reason: "Id de pagamento inválido." };

    // Fonte da verdade: a API do Mercado Pago (nunca o corpo da notificação).
    const payment = await this.fetchPayment(dataId);
    const status = mapMercadoPagoStatus(payment.status, payment.status_detail);
    const paidAmountCents = decimalToCents(payment.transaction_amount ?? null);

    return {
      ok: true,
      eventId: `${payment.id}:${status}`,
      type: notification.action ?? "payment.updated",
      providerPaymentId: payment.id,
      status,
      ...(paidAmountCents === null ? {} : { paidAmountCents }),
      externalReference: payment.external_reference ?? null,
      raw: {
        notification: {
          id: notification.id ?? null,
          type,
          action: notification.action ?? null,
          liveMode: notification.live_mode ?? null,
          dateCreated: notification.date_created ?? null,
        },
        payment: {
          id: payment.id,
          status: payment.status,
          statusDetail: payment.status_detail ?? null,
          externalReference: payment.external_reference ?? null,
          transactionAmount: payment.transaction_amount ?? null,
        },
      },
    };
  }
}
