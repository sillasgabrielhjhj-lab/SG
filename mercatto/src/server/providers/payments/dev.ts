import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { centsToDecimalString } from "@/server/providers/decimal";
import { ProviderConfigurationError, ProviderError } from "@/server/providers/errors";
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
 * GATEWAY DE DESENVOLVIMENTO — NÃO MOVIMENTA DINHEIRO.
 *
 *  - PIX: gera um payload propositalmente INVÁLIDO para pagamento
 *    ("MERCATTO-DEV-PIX|<paymentId>|<valor>|NAO-E-UM-PIX-VALIDO") e o QR Code
 *    correspondente. Nenhum banco aceita esse código. A aprovação é simulada
 *    disparando o MESMO fluxo de webhook assinado usado em produção
 *    (`createDevWebhookRequest` -> POST /api/webhooks/payments/dev).
 *  - Cartão: somente tokens de teste `dev_approved` (aprovado, visa •••• 4242)
 *    e `dev_declined` (recusado). Qualquer outro token é recusado.
 *  - Webhook: HMAC-SHA256 de `<timestamp>.<corpo bruto>` com
 *    PAYMENT_WEBHOOK_SECRET no header `x-mercatto-signature: t=<unix>,v1=<hex>`,
 *    tolerância de 5 minutos (anti-replay) e comparação em tempo constante.
 *    A idempotência por `eventId` é responsabilidade do processador de webhooks
 *    (tabela WebhookEvent, único por provider+eventId).
 *
 * A UI deve sinalizar `isSandbox` ("Ambiente de desenvolvimento — nenhuma
 * cobrança real").
 */

export const DEV_PAYMENT_PROVIDER = "dev";
export const DEV_SIGNATURE_HEADER = "x-mercatto-signature";
export const DEV_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
export const DEV_WEBHOOK_EVENT_TYPE = "payment.updated";
export const DEV_TEST_CARD_TOKENS = { approved: "dev_approved", declined: "dev_declined" } as const;
export const DEV_CARD_DECLINED_REASON = "Cartão recusado pelo emissor (simulação)";
export const DEV_CARD_INVALID_TOKEN_REASON = "Cartão não aprovado: token inválido (simulação).";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

const GATEWAY_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const satisfies readonly GatewayPaymentStatus[];

const devWebhookBodySchema = z.object({
  id: z.string().min(1).max(128),
  type: z.literal(DEV_WEBHOOK_EVENT_TYPE),
  data: z.object({
    providerPaymentId: z.string().regex(/^dev_[A-Za-z0-9_-]{1,64}$/, "providerPaymentId inválido"),
    status: z.enum(GATEWAY_STATUSES),
    amountCents: z.number().int().nonnegative().optional(),
  }),
});

export type DevWebhookBody = z.infer<typeof devWebhookBodySchema>;

function webhookSecret(): string {
  const secret = env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new ProviderConfigurationError(
      DEV_PAYMENT_PROVIDER,
      "PAYMENT_WEBHOOK_SECRET (mín. 16 caracteres) é obrigatório para assinar/validar webhooks do gateway de desenvolvimento.",
    );
  }
  return secret;
}

/** Payload "copia e cola" de demonstração — nunca é um BR Code válido. */
export function buildDevPixPayload(paymentId: string, amountCents: number): string {
  return `MERCATTO-DEV-PIX|${paymentId}|${centsToDecimalString(amountCents)}|NAO-E-UM-PIX-VALIDO`;
}

/** Assinatura hex (HMAC-SHA256) de `<timestamp>.<rawBody>` com PAYMENT_WEBHOOK_SECRET. */
export function signDevPayload(rawBody: string, timestamp: number): string {
  return createHmac("sha256", webhookSecret()).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

/** Interpreta `t=<unix>,v1=<hex>[,v1=<hex>]` (vários v1 permitem rotação de segredo). */
export function parseDevSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (!key || !value) return null;
    if (key === "t") {
      if (!/^\d{1,12}$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === "v1") {
      if (!/^[0-9a-f]{64}$/i.test(value)) return null;
      signatures.push(value.toLowerCase());
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/**
 * Monta uma requisição de webhook assinada exatamente como o "provedor dev"
 * enviaria. Usada por /api/dev/payments/simulate e pelos testes.
 */
export async function createDevWebhookRequest(input: {
  providerPaymentId: string;
  status: GatewayPaymentStatus;
  eventId?: string;
  amountCents?: number;
}): Promise<{ headers: Headers; rawBody: string; url: string }> {
  const body = devWebhookBodySchema.parse({
    id: input.eventId ?? `evt_dev_${randomUUID()}`,
    type: DEV_WEBHOOK_EVENT_TYPE,
    data: {
      providerPaymentId: input.providerPaymentId,
      status: input.status,
      ...(input.amountCents === undefined ? {} : { amountCents: input.amountCents }),
    },
  });
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = new Headers({
    "content-type": "application/json",
    [DEV_SIGNATURE_HEADER]: `t=${timestamp},v1=${signDevPayload(rawBody, timestamp)}`,
  });
  return { headers, rawBody, url: `${env.APP_URL}/api/webhooks/payments/${DEV_PAYMENT_PROVIDER}` };
}

function assertAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new ProviderError({
      provider: DEV_PAYMENT_PROVIDER,
      kind: "rejected",
      code: "PAYMENT_FAILED",
      userMessage: "Valor do pagamento inválido.",
      retryable: false,
    });
  }
}

export class DevPaymentGateway implements PaymentGateway {
  readonly name = DEV_PAYMENT_PROVIDER;
  readonly isSandbox = true;
  readonly supportsMethods: PaymentMethodCode[] = ["PIX", "CREDIT_CARD"];

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    assertAmount(input.amountCents);
    const providerPaymentId = `${DEV_PAYMENT_PROVIDER}_${input.paymentId}`;

    if (input.method === "PIX") {
      const qrCode = buildDevPixPayload(input.paymentId, input.amountCents);
      const qrCodeImageDataUrl = await QRCode.toDataURL(qrCode, { errorCorrectionLevel: "M", margin: 1, width: 320 });
      logger.info("payments.dev.pix_created", { paymentId: input.paymentId, amountCents: input.amountCents, sandbox: true });
      return {
        providerPaymentId,
        status: "PENDING",
        pix: { qrCode, qrCodeImageDataUrl, expiresAt: input.expiresAt },
        failureReason: null,
        isSandbox: true,
      };
    }

    const token = input.cardToken?.trim() ?? "";
    let result: CreatePaymentResult;
    if (token === DEV_TEST_CARD_TOKENS.approved) {
      result = { providerPaymentId, status: "PAID", card: { brand: "visa", last4: "4242" }, failureReason: null, isSandbox: true };
    } else if (token === DEV_TEST_CARD_TOKENS.declined) {
      result = { providerPaymentId, status: "FAILED", card: { brand: null, last4: null }, failureReason: DEV_CARD_DECLINED_REASON, isSandbox: true };
    } else {
      result = {
        providerPaymentId,
        status: "FAILED",
        card: { brand: null, last4: null },
        failureReason: DEV_CARD_INVALID_TOKEN_REASON,
        isSandbox: true,
      };
    }
    logger.info("payments.dev.card_processed", { paymentId: input.paymentId, status: result.status, sandbox: true });
    return result;
  }

  /**
   * O gateway dev NÃO possui estado remoto: o "provedor" é a própria
   * aplicação, e o estado só muda por webhooks assinados (simulados). Por isso
   * o status retornado espelha o Payment local — nunca rebaixa um pagamento
   * já confirmado e permite que a reconciliação (cron) expire PIX pendentes.
   */
  async getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentStatus> {
    const payment = await db.payment.findUnique({
      where: { providerPaymentId },
      select: { status: true, provider: true },
    });
    if (!payment || payment.provider !== DEV_PAYMENT_PROVIDER) {
      throw new ProviderError({
        provider: DEV_PAYMENT_PROVIDER,
        kind: "http",
        httpStatus: 404,
        code: "NOT_FOUND",
        userMessage: "Pagamento não encontrado no ambiente de desenvolvimento.",
        retryable: false,
      });
    }
    return payment.status;
  }

  /** Cancelamento simulado (sandbox): nada a desfazer em um provedor real. */
  async cancelPayment(providerPaymentId: string): Promise<void> {
    logger.info("payments.dev.cancelled", { providerPaymentId, sandbox: true });
  }

  /** Reembolso simulado (sandbox). Id determinístico por chave idempotente. */
  async refund(providerPaymentId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult> {
    assertAmount(amountCents);
    const digest = createHash("sha256").update(`${providerPaymentId}:${idempotencyKey}`).digest("hex").slice(0, 32);
    logger.info("payments.dev.refunded", { providerPaymentId, amountCents, sandbox: true });
    return { providerRefundId: `dev_rf_${digest}`, status: "SUCCEEDED" };
  }

  async verifyWebhook(request: { headers: Headers; rawBody: string; url: string }): Promise<WebhookVerification> {
    const header = request.headers.get(DEV_SIGNATURE_HEADER);
    if (!header) return { ok: false, reason: "Assinatura ausente." };
    if (Buffer.byteLength(request.rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return { ok: false, reason: "Corpo do webhook excede o tamanho máximo." };
    }

    const parsed = parseDevSignatureHeader(header);
    if (!parsed) return { ok: false, reason: "Cabeçalho de assinatura malformado." };

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - parsed.timestamp) > DEV_SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, reason: "Assinatura fora da janela de tolerância (possível replay)." };
    }

    const expected = signDevPayload(request.rawBody, parsed.timestamp);
    if (!parsed.signatures.some((signature) => safeEqualHex(signature, expected))) {
      return { ok: false, reason: "Assinatura inválida." };
    }

    let json: unknown;
    try {
      json = JSON.parse(request.rawBody);
    } catch {
      return { ok: false, reason: "Corpo do webhook não é JSON válido." };
    }
    const body = devWebhookBodySchema.safeParse(json);
    if (!body.success) return { ok: false, reason: "Evento com formato inválido." };

    return {
      ok: true,
      eventId: body.data.id,
      type: body.data.type,
      providerPaymentId: body.data.data.providerPaymentId,
      status: body.data.data.status,
      paidAmountCents: body.data.data.amountCents,
      externalReference: body.data.data.providerPaymentId.slice(DEV_PAYMENT_PROVIDER.length + 1),
      raw: body.data,
    };
  }
}
