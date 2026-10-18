/** Utilitários compartilhados pelos adaptadores de publicação (sem I/O próprio). */
import type { SendResult } from '../../domain/types.js';
import { HttpError } from '../../lib/http.js';
import { sanitizeForLog, scrubString } from '../../lib/logger.js';
import { SafeFetchError, SsrfBlockedError } from '../../lib/ssrf.js';

/** Prazo total de uma tentativa de envio (DNS + conexão + resposta). */
export const SEND_TIMEOUT_MS = 15_000;
/** Prazo dos testes de conexão. */
export const HEALTH_TIMEOUT_MS = 10_000;
/** Teto para esperas pedidas pelo provedor (429/Retry-After): evita travar o canal por horas. */
export const MAX_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Configuração/credencial ausente ou inválida para montar o adaptador.
 * kind = 'credentials' => falta autenticação (pausa o canal como AUTH_REQUIRED);
 * kind = 'config' => configuração do canal inválida (canal fica com erro até ser corrigido).
 */
export class AdapterConfigError extends Error {
  constructor(
    message: string,
    public readonly kind: 'credentials' | 'config',
  ) {
    super(message);
    this.name = 'AdapterConfigError';
  }
}

/** Mensagem curta e SEM segredos, própria para gravar em lastError/PublicationAttempt. */
export function cleanError(value: unknown, max = 300): string {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : JSON.stringify(sanitizeForLog(value)) ?? 'erro desconhecido';
  const s = scrubString(raw).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Limita a espera sugerida pelo provedor. */
export function capRetryAfter(ms: number | undefined): number | undefined {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

/**
 * Falha de transporte (rede, DNS, timeout, SSRF) => SendResult.
 * Bloqueio SSRF é permanente (a URL configurada nunca será aceita); o resto é retentável.
 */
export function transportFailure(err: unknown): SendResult {
  if (err instanceof SsrfBlockedError) {
    return { ok: false, confirmed: false, permanent: true, error: `Destino bloqueado pela proteção SSRF: ${cleanError(err)}` };
  }
  if (err instanceof HttpError) return { ok: false, confirmed: false, httpStatus: err.status, error: cleanError(err) };
  const label = err instanceof SafeFetchError ? err.code : err instanceof Error ? err.name : 'erro';
  return { ok: false, confirmed: false, error: `Falha de rede (${label}): ${cleanError(err)}` };
}

/** Resultado "não confirmado" para respostas 2xx sem o identificador esperado. */
export function unconfirmed(httpStatus: number, error: string, response?: unknown): SendResult {
  return { ok: false, confirmed: false, httpStatus, error, ...(response !== undefined ? { response: sanitizeForLog(response) } : {}) };
}

/** Só URLs https absolutas servem como imagem (o provedor baixa a imagem; nunca enviamos arquivos locais). */
export function httpsUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
