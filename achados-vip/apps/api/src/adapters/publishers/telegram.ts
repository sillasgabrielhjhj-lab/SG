/**
 * Telegram Bot API (Modo C) — método oficial de automação para canais/grupos.
 *
 * - Com imagem https e texto <= 1024 caracteres: sendPhoto (legenda). Caso contrário: sendMessage com a
 *   pré-visualização do link. parse_mode HTML (o formatador já escapa & < >).
 * - CONFIRMADO somente se a resposta trouxer result.message_id.
 * - 429: respeita parameters.retry_after. 401/403/404: autenticação/permissão (pausa o canal). 400: permanente
 *   (exceto falha ao baixar a foto, que cai para sendMessage). 5xx/rede: retentável.
 * - O token faz parte da URL da Bot API: nenhuma URL/erro com token é devolvido ou logado (scrubString).
 * STATUS: a validar com o seu bot (o sandbox bloqueia api.telegram.org; testes usam servidor SIMULADO).
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

export const TELEGRAM_DEFAULT_BASE_URL = 'https://api.telegram.org';
export const TELEGRAM_CAPTION_MAX = 1024;
export const TELEGRAM_TEXT_MAX = 4096;

export interface TelegramOptions {
  botToken: string;
  chatId: string;
  baseUrl?: string;
}

/** Erros 400 de foto (URL inacessível, formato/dimensões) => vale cair para texto. */
const PHOTO_PROBLEM_RE = /(failed to get http url content|wrong type of the web page content|wrong file identifier|photo_invalid_dimensions|image_process_failed|wrong remote file)/i;

/** Primeiro link do texto. O texto está em HTML (& vira &amp;): a URL da pré-visualização precisa voltar ao original. */
const firstUrl = (text: string): string | null => /https?:\/\/[^\s<>"']+/.exec(text)?.[0]?.replace(/&amp;/g, '&') ?? null;

export class TelegramPublisher implements PublisherAdapter {
  readonly type = 'TELEGRAM' as const;
  readonly format = 'telegram_html' as const;
  readonly automatic = true;

  private readonly root: string;

  constructor(private readonly opts: TelegramOptions) {
    this.root = (opts.baseUrl ?? TELEGRAM_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private call(method: string, body: Record<string, unknown>, timeoutMs = SEND_TIMEOUT_MS): Promise<HttpResult> {
    return httpRequest(`${this.root}/bot${this.opts.botToken}/${method}`, {
      method: 'POST',
      json: body,
      timeoutMs,
      retries: 0, // quem retenta é o serviço de publicação
      followRedirects: false,
    });
  }

  async send(payload: PublishPayload): Promise<SendResult> {
    const text = payload.text;
    if (!text.trim()) return { ok: false, confirmed: false, permanent: true, error: 'Mensagem vazia' };
    if (text.length > TELEGRAM_TEXT_MAX) {
      return { ok: false, confirmed: false, permanent: true, error: `Mensagem maior que o limite de ${TELEGRAM_TEXT_MAX} caracteres` };
    }
    const photo = text.length <= TELEGRAM_CAPTION_MAX ? httpsUrlOrNull(payload.imageUrl) : null;

    if (photo) {
      const first = await this.attempt('sendPhoto', { chat_id: this.opts.chatId, photo, caption: text, parse_mode: 'HTML' });
      // foto recusada (400 por causa da imagem): publica só o texto em vez de perder a oferta
      if (first.httpStatus === 400 && PHOTO_PROBLEM_RE.test(first.error ?? '')) return this.sendText(text);
      return first;
    }
    return this.sendText(text);
  }

  private sendText(text: string): Promise<SendResult> {
    const url = firstUrl(text);
    return this.attempt('sendMessage', {
      chat_id: this.opts.chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: url ? { is_disabled: false, url, prefer_large_media: true } : { is_disabled: false },
    });
  }

  private async attempt(method: string, body: Record<string, unknown>): Promise<SendResult> {
    let res: HttpResult;
    try {
      res = await this.call(method, body);
    } catch (err) {
      return transportFailure(err);
    }
    return this.interpret(res);
  }

  /** Confirmado SOMENTE com ok:true e result.message_id. */
  private interpret(res: HttpResult): SendResult {
    const json = asRecord(parseJsonSafe(res.text));
    if (res.ok && json?.ok === true) {
      const id = asRecord(json.result)?.message_id;
      if (typeof id === 'number' || (typeof id === 'string' && id)) {
        return { ok: true, confirmed: true, externalMessageId: String(id), httpStatus: res.status, response: { messageId: id } };
      }
      return unconfirmed(res.status, 'Resposta do Telegram sem message_id: envio NÃO confirmado', json);
    }
    if (res.ok) return unconfirmed(res.status, 'Resposta do Telegram sem ok:true: envio NÃO confirmado', json);

    const description = cleanError(typeof json?.description === 'string' ? json.description : `HTTP ${res.status}`);
    const params = asRecord(json?.parameters);
    const fail: SendResult = {
      ok: false,
      confirmed: false,
      httpStatus: res.status,
      error: `Telegram ${res.status}: ${description}`,
      response: sanitizeForLog({ error_code: json?.error_code ?? res.status, description }),
    };
    if (res.status === 429) {
      const retryAfter = typeof params?.retry_after === 'number' ? params.retry_after * 1000 : parseRetryAfter(res.headers['retry-after']);
      const ms = capRetryAfter(retryAfter);
      return { ...fail, ...(ms !== undefined ? { retryAfterMs: ms } : {}) };
    }
    // token inválido (401), mal formado (404) ou bot sem permissão/removido (403): pausa o canal
    if (res.status === 401 || res.status === 403 || res.status === 404) return { ...fail, permanent: true, authRequired: true };
    if (res.status >= 500) return fail;
    return { ...fail, permanent: true }; // 400 e demais: chat inexistente, mensagem inválida...
  }

  async healthCheck(): Promise<HealthResult> {
    let me: HttpResult;
    try {
      me = await this.call('getMe', {}, HEALTH_TIMEOUT_MS);
    } catch (err) {
      return { ok: false, status: 'ERROR', detail: transportFailure(err).error ?? 'Falha de rede' };
    }
    const meJson = asRecord(parseJsonSafe(me.text));
    if (me.status === 401 || me.status === 404) {
      return { ok: false, status: 'AUTH_REQUIRED', detail: 'Token do bot recusado pelo Telegram (revogado ou incorreto)' };
    }
    if (!me.ok || meJson?.ok !== true) {
      return { ok: false, status: 'ERROR', detail: `Telegram respondeu HTTP ${me.status}: ${cleanError(meJson?.description ?? 'resposta inesperada')}` };
    }
    const username = asRecord(meJson.result)?.username;
    const botName = typeof username === 'string' ? `@${username}` : 'bot';

    // confere se o bot enxerga o chat configurado
    let chat: HttpResult;
    try {
      chat = await this.call('getChat', { chat_id: this.opts.chatId }, HEALTH_TIMEOUT_MS);
    } catch (err) {
      return { ok: false, status: 'ERROR', detail: transportFailure(err).error ?? 'Falha de rede' };
    }
    const chatJson = asRecord(parseJsonSafe(chat.text));
    if (!chat.ok || chatJson?.ok !== true) {
      const why = cleanError(chatJson?.description ?? `HTTP ${chat.status}`);
      if (chat.status === 403) return { ok: false, status: 'AUTH_REQUIRED', detail: `${botName} sem acesso ao chat: ${why}` };
      return { ok: false, status: 'ERROR', detail: `${botName} autenticado, mas o chat configurado não foi encontrado/acessível: ${why}` };
    }
    const title = asRecord(chatJson.result)?.title;
    return {
      ok: true,
      status: 'CONNECTED',
      detail: `${botName} acessa ${typeof title === 'string' ? `"${cleanError(title, 80)}"` : 'o chat'}. A permissão de publicar só é confirmada no primeiro envio.`,
    };
  }
}
