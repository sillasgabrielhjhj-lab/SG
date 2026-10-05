import "server-only";
import { AppError, type AppErrorCode } from "@/server/errors";

/**
 * Erros dos provedores externos.
 *
 * - `ProviderConfigurationError`: configuração ausente/inválida (problema de
 *   operação, não do usuário). NÃO é AppError: o usuário recebe a mensagem
 *   genérica e a mensagem detalhada vai para o log.
 * - `ProviderError`: falha de comunicação/resposta do provedor. É AppError com
 *   mensagem amigável em pt-BR (pode ser exibida ao usuário); detalhes técnicos
 *   ficam em `provider`, `kind`, `httpStatus` (somente para logs).
 */

export class ProviderConfigurationError extends Error {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderConfigurationError";
    this.provider = provider;
  }
}

export type ProviderErrorKind = "timeout" | "network" | "http" | "invalid_response" | "unavailable" | "rejected";

export class ProviderError extends AppError {
  readonly provider: string;
  readonly kind: ProviderErrorKind;
  readonly httpStatus: number | null;
  /** true quando repetir a operação (mesma chave idempotente) pode resolver. */
  readonly retryable: boolean;

  constructor(opts: {
    provider: string;
    kind: ProviderErrorKind;
    userMessage: string;
    code?: AppErrorCode;
    httpStatus?: number | null;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(opts.code ?? "INTERNAL", opts.userMessage, { cause: opts.cause });
    this.name = "ProviderError";
    this.provider = opts.provider;
    this.kind = opts.kind;
    this.httpStatus = opts.httpStatus ?? null;
    this.retryable = opts.retryable ?? (opts.kind === "timeout" || opts.kind === "network" || opts.kind === "unavailable");
  }
}

export const isProviderError = (error: unknown): error is ProviderError => error instanceof ProviderError;
