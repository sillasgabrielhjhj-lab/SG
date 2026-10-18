/**
 * Webhook autorizado (Modo C): POST JSON para uma URL do administrador (n8n, Make, serviço próprio).
 *
 * Corpo: { event, publication, text, imageUrl, idempotencyKey, sentAt }.
 * Assinatura: header `X-Signature: sha256=<hex>` = HMAC-SHA256 do CORPO BRUTO com o segredo do canal.
 * O receptor deve recalcular sobre os bytes recebidos e comparar em tempo constante; também deve ignorar
 * repetições pelo `idempotencyKey` (reentregas podem ocorrer após falhas de rede).
 * Segurança: a URL passa pela proteção SSRF (safeFetch: DNS fixado, sem rede interna, sem seguir redirecionamentos).
 * Confirmação: qualquer 2xx = o RECEPTOR aceitou a entrega (não significa que a plataforma final publicou).
 */
import type { HealthResult, PublishPayload, PublisherAdapter, SendResult } from '../../domain/types.js';
import { hmacSign } from '../../lib/crypto.js';
import { httpRequest, parseRetryAfter, type HttpResult } from '../../lib/http.js';
import { assertSafeUrl, SsrfBlockedError } from '../../lib/ssrf.js';
import { HEALTH_TIMEOUT_MS, SEND_TIMEOUT_MS, asRecord, capRetryAfter, cleanError, parseJsonSafe, transportFailure } from './common.js';

export const WEBHOOK_EVENT = 'offer.publish';
export const SIGNATURE_HEADER = 'x-signature';
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export interface WebhookOptions {
  url: string;
  secret: string;
  /** Relógio injetável (testes). */
  now?: () => Date;
}

/** Assinatura no formato enviado no header: "sha256=<hex>". */
export function signWebhookBody(rawBody: string | Buffer, secret: string): string {
  return `sha256=${hmacSign(rawBody, secret)}`;
}

export class WebhookPublisher implements PublisherAdapter {
  readonly type = 'WEBHOOK' as const;
  readonly format = 'plain' as const;
  readonly automatic = true;

  constructor(private readonly opts: WebhookOptions) {}

  async send(payload: PublishPayload): Promise<SendResult> {
    // idempotencyKey = "<offerId>:<channelId>"
    const [offerId, channelId] = payload.idempotencyKey.split(':');
    const body = {
      event: WEBHOOK_EVENT,
      publication: { offerId: offerId ?? null, channelId: channelId ?? null, idempotencyKey: payload.idempotencyKey },
      text: payload.text,
      imageUrl: payload.imageUrl ?? null,
      idempotencyKey: payload.idempotencyKey,
      sentAt: (this.opts.now?.() ?? new Date()).toISOString(),
    };
    const raw = JSON.stringify(body);

    let res: HttpResult;
    try {
      res = await httpRequest(this.opts.url, {
        method: 'POST',
        body: raw,
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signWebhookBody(raw, this.opts.secret),
          [IDEMPOTENCY_HEADER]: payload.idempotencyKey,
        },
        timeoutMs: SEND_TIMEOUT_MS,
        retries: 0,
        followRedirects: false, // o corpo assinado não deve seguir para outro destino
      });
    } catch (err) {
      return transportFailure(err);
    }
    return this.interpret(res);
  }

  private interpret(res: HttpResult): SendResult {
    if (res.ok) {
      const json = asRecord(parseJsonSafe(res.text));
      const id = json?.id;
      return {
        ok: true,
        confirmed: true,
        httpStatus: res.status,
        ...(typeof id === 'string' || typeof id === 'number' ? { externalMessageId: String(id) } : {}),
        response: { status: res.status },
      };
    }
    const fail: SendResult = { ok: false, confirmed: false, httpStatus: res.status, error: `Webhook respondeu HTTP ${res.status}: ${cleanError(res.text.slice(0, 200) || 'sem corpo')}`, response: { status: res.status } };
    if (res.status >= 300 && res.status < 400) {
      return { ...fail, permanent: true, error: `Webhook respondeu redirecionamento HTTP ${res.status} (não seguido); atualize a URL do canal` };
    }
    if (res.status === 401 || res.status === 403) return { ...fail, permanent: true, authRequired: true }; // receptor recusou a assinatura
    if (res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500) {
      const ms = capRetryAfter(parseRetryAfter(res.headers['retry-after']));
      return { ...fail, ...(ms !== undefined ? { retryAfterMs: ms } : {}) };
    }
    return { ...fail, permanent: true };
  }

  /**
   * Teste de conexão: valida a URL (SSRF) e tenta HEAD. Qualquer resposta HTTP prova alcance de rede, mas não que
   * o receptor aceitará um POST assinado — isso só é confirmado no primeiro envio.
   */
  async healthCheck(): Promise<HealthResult> {
    try {
      await assertSafeUrl(this.opts.url);
    } catch (err) {
      const why = err instanceof SsrfBlockedError ? err.message : cleanError(err);
      return { ok: false, status: 'ERROR', detail: `URL recusada pela proteção SSRF: ${why}` };
    }
    try {
      const res = await httpRequest(this.opts.url, { method: 'HEAD', timeoutMs: HEALTH_TIMEOUT_MS, retries: 0, followRedirects: false });
      return {
        ok: true,
        status: 'CONNECTED',
        detail: `Servidor alcançável (HEAD respondeu HTTP ${res.status}). A aceitação do POST assinado só é confirmada no primeiro envio.`,
      };
    } catch (err) {
      return { ok: false, status: 'ERROR', detail: transportFailure(err).error ?? 'Falha de rede' };
    }
  }
}
