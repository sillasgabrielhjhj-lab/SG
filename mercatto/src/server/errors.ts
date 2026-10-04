import "server-only";
import { z } from "zod";

/**
 * Erros de domínio com mensagem segura para o usuário final.
 * Qualquer erro que NÃO seja AppError é tratado como interno: a mensagem
 * original é registrada no log e o usuário recebe uma mensagem genérica.
 */
export type AppErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "UNPROCESSABLE"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  RATE_LIMITED: 429,
  PAYMENT_FAILED: 402,
  UNPROCESSABLE: 422,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    opts?: { fieldErrors?: Record<string, string[]>; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, { cause: opts?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = opts?.fieldErrors;
    this.details = opts?.details;
  }
}

export const badRequest = (msg: string) => new AppError("BAD_REQUEST", msg);
export const unauthenticated = (msg = "Faça login para continuar.") => new AppError("UNAUTHENTICATED", msg);
export const forbidden = (msg = "Você não tem permissão para esta ação.") => new AppError("FORBIDDEN", msg);
export const notFound = (msg = "Não encontrado.") => new AppError("NOT_FOUND", msg);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);

export function validationError(error: z.ZodError, message = "Verifique os campos destacados.") {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new AppError("VALIDATION", message, { fieldErrors });
}

/** Valida dados com Zod lançando AppError(VALIDATION) amigável. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
