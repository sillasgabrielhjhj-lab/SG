import "server-only";
import { NextResponse } from "next/server";
import { isAppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { assertSameOrigin } from "@/server/security/request";

/**
 * Wrapper para Route Handlers: tratamento centralizado de erros e proteção
 * CSRF (same-origin) para métodos que alteram estado.
 */
export function apiRoute<C = unknown>(
  handler: (request: Request, context: C) => Promise<Response>,
  options: { csrf?: boolean } = {},
) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      if (mutating && options.csrf !== false) assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error, new URL(request.url).pathname);
    }
  };
}

export function errorResponse(error: unknown, context?: string) {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }
  logger.error("api.unhandled_error", { context, error });
  return NextResponse.json({ error: "Erro interno. Tente novamente.", code: "INTERNAL" }, { status: 500 });
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
