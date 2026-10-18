/**
 * WhatsApp Business Platform — Groups API (Modo A).
 *
 * ÚNICO método oficial para publicar em GRUPO no WhatsApp. Restrições (segundo a documentação da Meta,
 * consultada indiretamente — ver docs/VIABILIDADE.md):
 *   - exige número/conta da WhatsApp Business Platform (Cloud API) com token de usuário do sistema;
 *   - o grupo precisa ter sido CRIADO VIA API (grupos comuns do aplicativo NÃO são alcançáveis);
 *   - máximo de 8 participantes por grupo; entrada somente por link de convite;
 *   - mensagens seguem as políticas e a cobrança da Meta.
 * STATUS: PARA VALIDAR com credenciais reais. Nenhuma chamada real foi feita (o sandbox bloqueia a Meta);
 * os testes usam um servidor HTTP SIMULADO. Nomes de campos, códigos de erro e a versão da Graph API
 * (`apiVersion`, configurável) devem ser conferidos na documentação vigente antes de usar em produção.
 *
 * Envio: POST {base}/{versão}/{phoneNumberId}/messages com recipient_type "group". Só é CONFIRMADO se a
 * resposta trouxer messages[0].id. O token vai no header Authorization e nunca é logado.
 */
import type { HealthResult, PublishPayload, PublisherAdapter, SendResult } from '../../domain/types.js';
import { httpRequest, parseRetryAfter, type HttpResult } from '../../lib/http.js';
import { sanitizeForLog } from '../../lib/logger.js';
import {
  HEALTH_TIMEOUT_MS,
  SEND_TIMEOUT_MS,
  asRecord,
  capRetryAfter,
  cleanError,
  httpsUrlOrNull,
  parseJsonSafe,
  transportFailure,
  unconfirmed,
} from './common.js';

export const WHATSAPP_DEFAULT_BASE_URL = 'https://graph.facebook.com';
export const WHATSAPP_DEFAULT_API_VERSION = 'v23.0';
/** Limites de texto do WhatsApp: corpo 4096, legenda de imagem 1024. */
export const WHATSAPP_TEXT_LIMIT = 4096;
export const WHATSAPP_CAPTION_LIMIT = 1024;

export interface WhatsAppCloudOptions {
  accessToken: string;
  phoneNumberId: string;
  groupId: string;
  apiVersion?: string;
  /** Padrão: https://graph.facebook.com (em produção só o host oficial é aceito pela config). */
  baseUrl?: string;
}

/** Códigos de erro da Graph API que significam "tente depois" (limite de taxa/vazão). */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80007, 130429, 131048, 131056]);
/** Token inválido/expirado (OAuthException) e sessão inválida. */
const AUTH_CODES = new Set([102, 190]);
/** Permissões insuficientes. */
const PERMISSION_CODES = new Set([10, 200, 299]);

export class WhatsAppCloudGroupPublisher implements PublisherAdapter {
  readonly type = 'WHATSAPP_CLOUD_GROUP' as const;
  readonly format = 'whatsapp' as const;
  readonly automatic = true;

  private readonly base: string;

  constructor(private readonly opts: WhatsAppCloudOptions) {
    const root = (opts.baseUrl ?? WHATSAPP_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.base = `${root}/${opts.apiVersion ?? WHATSAPP_DEFAULT_API_VERSION}`;
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.opts.accessToken}` };
  }

  async send(payload: PublishPayload): Promise<SendResult> {
    const text = payload.text;
    if (!text.trim()) return { ok: false, confirmed: false, permanent: true, error: 'Mensagem vazia' };
    if (text.length > WHATSAPP_TEXT_LIMIT) {
      return { ok: false, confirmed: false, permanent: true, error: `Mensagem maior que o limite de ${WHATSAPP_TEXT_LIMIT} caracteres` };
    }

    // Imagem com legenda só quando a legenda cabe; senão, texto com pré-visualização do link.
    const image = text.length <= WHATSAPP_CAPTION_LIMIT ? httpsUrlOrNull(payload.imageUrl) : null;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'group',
      to: this.opts.groupId,
      ...(image
        ? { type: 'image', image: { link: image, caption: text } }
        : { type: 'text', text: { body: text, preview_url: true } }),
    };

    let res: HttpResult;
    try {
      res = await httpRequest(`${this.base}/${this.opts.phoneNumberId}/messages`, {
        method: 'POST',
        headers: this.headers(),
        json: body,
        timeoutMs: SEND_TIMEOUT_MS,
        retries: 0, // quem retenta é o serviço de publicação (backoff + limite de tentativas)
        followRedirects: false,
      });
    } catch (err) {
      return transportFailure(err);
    }
    return this.interpret(res);
  }

  /** Converte a resposta HTTP em SendResult. Confirmado SOMENTE com messages[0].id. */
  private interpret(res: HttpResult): SendResult {
    const json = asRecord(parseJsonSafe(res.text));
    if (res.ok) {
      const messages = Array.isArray(json?.messages) ? json.messages : [];
      const id = asRecord(messages[0])?.id;
      if (typeof id === 'string' && id.length > 0) {
        return { ok: true, confirmed: true, externalMessageId: id, httpStatus: res.status, response: { messageId: id } };
      }
      return unconfirmed(res.status, 'Resposta da Meta sem id de mensagem: envio NÃO confirmado', json);
    }

    const err = asRecord(json?.error);
    const code = typeof err?.code === 'number' ? err.code : undefined;
    const detail = cleanError(typeof err?.message === 'string' ? err.message : `HTTP ${res.status}`);
    const base = {
      ok: false,
      confirmed: false,
      httpStatus: res.status,
      error: `WhatsApp ${res.status}${code !== undefined ? ` (código ${code})` : ''}: ${detail}`,
      response: sanitizeForLog(err ?? { status: res.status }),
    } satisfies SendResult;

    if (res.status === 401 || (code !== undefined && AUTH_CODES.has(code))) {
      return { ...base, permanent: true, authRequired: true };
    }
    if (res.status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) {
      const retryAfterMs = capRetryAfter(parseRetryAfter(res.headers['retry-after']));
      return { ...base, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };
    }
    if (res.status >= 500) return base; // retentável
    if (res.status === 403 || (code !== undefined && PERMISSION_CODES.has(code))) {
      return { ...base, permanent: true, authRequired: true }; // permissão/escopo do token
    }
    return { ...base, permanent: true }; // demais 4xx: payload/política rejeitada, não adianta repetir
  }

  /** Verifica token + Phone Number ID (GET do número). O grupo é consultado em modo "melhor esforço". */
  async healthCheck(): Promise<HealthResult> {
    let res: HttpResult;
    try {
      res = await httpRequest(`${this.base}/${this.opts.phoneNumberId}`, {
        headers: this.headers(),
        query: { fields: 'display_phone_number,verified_name' },
        timeoutMs: HEALTH_TIMEOUT_MS,
        retries: 0,
        followRedirects: false,
      });
    } catch (err) {
      const f = transportFailure(err);
      return { ok: false, status: 'ERROR', detail: f.error ?? 'Falha de rede' };
    }
    if (!res.ok) {
      const json = asRecord(parseJsonSafe(res.text));
      const err = asRecord(json?.error);
      const code = typeof err?.code === 'number' ? err.code : undefined;
      const msg = cleanError(typeof err?.message === 'string' ? err.message : `HTTP ${res.status}`);
      if (res.status === 401 || res.status === 403 || (code !== undefined && (AUTH_CODES.has(code) || PERMISSION_CODES.has(code)))) {
        return { ok: false, status: 'AUTH_REQUIRED', detail: `Token recusado pela Meta (HTTP ${res.status}): ${msg}` };
      }
      return { ok: false, status: 'ERROR', detail: `Meta respondeu HTTP ${res.status}: ${msg}` };
    }

    const info = asRecord(parseJsonSafe(res.text));
    const phone = typeof info?.display_phone_number === 'string' ? info.display_phone_number : 'número verificado';
    let groupNote = 'o grupo só é confirmado no primeiro envio';
    try {
      const g = await httpRequest(`${this.base}/${this.opts.groupId}`, {
        headers: this.headers(),
        query: { fields: 'subject' },
        timeoutMs: HEALTH_TIMEOUT_MS,
        retries: 0,
        followRedirects: false,
      });
      groupNote = g.ok ? 'grupo acessível' : `grupo não pôde ser consultado (HTTP ${g.status}) — confira o groupId`;
    } catch {
      groupNote = 'grupo não pôde ser consultado — confira o groupId';
    }
    return { ok: true, status: 'CONNECTED', detail: `Número ${phone} acessível; ${groupNote}. Groups API: a validar com credenciais reais.` };
  }
}
