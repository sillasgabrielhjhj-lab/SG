import "server-only";
import type { AppErrorCode } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { ProviderError } from "@/server/providers/errors";

/**
 * Cliente HTTP comum dos provedores externos:
 *  - timeout obrigatório (AbortSignal.timeout);
 *  - erros convertidos em `ProviderError` com mensagem amigável;
 *  - logs sem segredos: nunca registra headers, corpo da requisição nem query
 *    string (pode conter tokens/dados pessoais) — só método, host+caminho,
 *    status e a mensagem de erro resumida do provedor.
 */

export type ProviderRequest = {
  provider: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  /** Serializado como JSON quando informado. */
  json?: unknown;
  timeoutMs: number;
  /** Mensagem exibível ao usuário caso a chamada falhe. */
  userMessage: string;
  /** Código do AppError lançado em falha (padrão INTERNAL). */
  errorCode?: AppErrorCode;
  /** Status HTTP não-2xx tratados pelo chamador (não lançam). */
  acceptStatuses?: number[];
};

export type ProviderResponse<T> = { status: number; data: T; headers: Headers };

/** URL segura para log (sem query string/fragmento). */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "[url inválida]";
  }
}

/** Extrai uma mensagem curta do corpo de erro do provedor (sem dados do payload). */
function summarizeErrorBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const parts = [record.error, record.message, record.name, record.code]
    .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
    .map(String);
  return parts.length ? parts.join(" | ").slice(0, 300) : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export async function providerRequest<T = unknown>(req: ProviderRequest): Promise<ProviderResponse<T>> {
  const method = req.method ?? (req.json === undefined ? "GET" : "POST");
  const target = describeUrl(req.url);
  const headers: Record<string, string> = { Accept: "application/json", ...req.headers };
  if (req.json !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(req.url, {
      method,
      headers,
      body: req.json === undefined ? undefined : JSON.stringify(req.json),
      signal: AbortSignal.timeout(req.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timeout = isAbortError(error);
    logger.warn("provider.request_failed", {
      provider: req.provider,
      method,
      target,
      reason: timeout ? `timeout após ${req.timeoutMs}ms` : error instanceof Error ? error.message : "erro de rede",
    });
    throw new ProviderError({
      provider: req.provider,
      kind: timeout ? "timeout" : "network",
      userMessage: req.userMessage,
      code: req.errorCode,
      cause: error,
    });
  }

  const raw = await response.text().catch(() => "");
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
      if (response.ok) {
        logger.warn("provider.invalid_json", { provider: req.provider, method, target, status: response.status });
        throw new ProviderError({
          provider: req.provider,
          kind: "invalid_response",
          userMessage: req.userMessage,
          code: req.errorCode,
          httpStatus: response.status,
        });
      }
    }
  }

  if (!response.ok && !req.acceptStatuses?.includes(response.status)) {
    const retryable = response.status === 429 || response.status >= 500;
    logger.warn("provider.http_error", {
      provider: req.provider,
      method,
      target,
      status: response.status,
      detail: summarizeErrorBody(data),
    });
    throw new ProviderError({
      provider: req.provider,
      kind: response.status >= 500 ? "unavailable" : "http",
      userMessage: req.userMessage,
      code: req.errorCode,
      httpStatus: response.status,
      retryable,
    });
  }

  return { status: response.status, data: data as T, headers: response.headers };
}
