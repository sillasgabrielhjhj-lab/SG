import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { AppError, isAppError, validationError, type AppErrorCode } from "@/server/errors";
import { logger } from "@/server/observability/logger";

/**
 * Resultado padronizado de Server Actions. Componentes client exibem
 * `error`/`fieldErrors` sem nunca receber detalhes internos.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code: AppErrorCode; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function toActionError(error: unknown, context?: string): ActionResult<never> {
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  logger.error("action.unhandled_error", { context, error });
  return { ok: false, error: "Algo deu errado. Tente novamente em instantes.", code: "INTERNAL" };
}

/** Converte FormData em objeto simples (campos repetidos viram arrays). */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, v] : [prev, v];
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Cria uma Server Action validada:
 *   export const updateX = createAction(schema, async (input) => { ... return ok(data) })
 * - Aceita objeto ou FormData.
 * - Valida com Zod (erros por campo).
 * - Converte exceções em ActionResult seguro (redirect/notFound são repassados).
 */
export function createAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>) => Promise<ActionResult<T>>,
  name?: string,
) {
  return async (input: z.input<S> | FormData): Promise<ActionResult<T>> => {
    try {
      const raw = input instanceof FormData ? formDataToObject(input) : input;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw validationError(parsed.error);
      return await handler(parsed.data);
    } catch (error) {
      unstable_rethrow(error);
      return toActionError(error, name);
    }
  };
}

/** Executa uma função protegendo contra exceções (para actions sem input). */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>, name?: string): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error, name);
  }
}

export { AppError };
