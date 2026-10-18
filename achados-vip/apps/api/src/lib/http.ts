import { safeFetch, SafeFetchError, type SafeFetchOptions } from './ssrf.js';
import { scrubString } from './logger.js';
import { sleep } from './time.js';

/**
 * Cliente HTTP para integrações externas (Mercado Livre, Telegram, Meta, webhooks).
 * Toda requisição passa por `safeFetch` (proteção SSRF, timeout, limite de tamanho).
 * Nunca lança por status HTTP em `httpRequest`; use `httpJson` para lançar HttpError em não-2xx.
 */

export interface HttpRequestOptions extends Omit<SafeFetchOptions, 'body'> {
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Corpo JSON (define content-type automaticamente). */
  json?: unknown;
  body?: string | Buffer;
  /** Tentativas extras em erro de rede/429/502/503/504. Padrão: 2 para GET/HEAD, 0 nos demais. */
  retries?: number;
  /** Base do backoff exponencial. Padrão 500ms. */
  retryDelayMs?: number;
}

export interface HttpResult {
  status: number;
  ok: boolean;
  headers: Record<string, string | string[] | undefined>;
  /** Corpo como texto. */
  text: string;
  json<T = unknown>(): T;
  /** URL final SEM query string (segura para log). */
  url: string;
  durationMs: number;
  attempts: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    /** Trecho do corpo, já sem segredos. */
    public readonly bodySnippet: string,
  ) {
    super(`HTTP ${status} em ${url}`);
    this.name = 'HttpError';
  }
}

/** Remove query string/fragmento e credenciais — seguro para logs e mensagens de erro. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    u.search = '';
    u.hash = '';
    return scrubString(u.toString());
  } catch {
    return scrubString(url.split('?')[0] ?? url);
  }
}

/** Interpreta Retry-After (segundos ou data HTTP) em milissegundos. */
export function parseRetryAfter(value: string | string[] | undefined, nowMs = Date.now()): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return undefined;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(v);
  return Number.isNaN(date) ? undefined : Math.max(0, date - nowMs);
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 30_000;

function buildUrl(url: string, query: HttpRequestOptions['query']): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function httpRequest(url: string, opts: HttpRequestOptions = {}): Promise<HttpResult> {
  const { query, json, retries, retryDelayMs = 500, ...rest } = opts;
  const method = (opts.method ?? 'GET').toUpperCase();
  const maxRetries = retries ?? (method === 'GET' || method === 'HEAD' ? 2 : 0);
  const headers = { ...(opts.headers ?? {}) };
  let body = opts.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
  }
  const target = buildUrl(url, query);
  const started = Date.now();

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await safeFetch(target, { ...rest, method, headers, ...(body !== undefined ? { body } : {}) });
      if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
        const wait = Math.min(parseRetryAfter(res.headers['retry-after']) ?? retryDelayMs * 2 ** attempt, MAX_RETRY_WAIT_MS);
        await sleep(wait);
        continue;
      }
      return {
        status: res.status,
        ok: res.status >= 200 && res.status < 300,
        headers: res.headers,
        text: res.text(),
        json: <T>() => res.json<T>(),
        url: redactUrl(res.url),
        durationMs: Date.now() - started,
        attempts: attempt + 1,
      };
    } catch (err) {
      // bloqueio SSRF, limite de tamanho e redirecionamentos não adianta repetir
      const permanent = err instanceof SafeFetchError && err.code !== 'FETCH_TIMEOUT';
      if (permanent || attempt >= maxRetries) throw err;
      await sleep(Math.min(retryDelayMs * 2 ** attempt, MAX_RETRY_WAIT_MS));
    }
  }
}

/** Faz a requisição e devolve o JSON; lança HttpError (corpo sanitizado) se o status não for 2xx. */
export async function httpJson<T = unknown>(url: string, opts: HttpRequestOptions = {}): Promise<T> {
  const res = await httpRequest(url, opts);
  if (!res.ok) throw new HttpError(res.status, res.url, scrubString(res.text).slice(0, 500));
  return res.json<T>();
}
