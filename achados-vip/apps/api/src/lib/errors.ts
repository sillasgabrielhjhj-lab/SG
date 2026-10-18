import type { ZodType, z } from 'zod';

/**
 * Erros de domínio tipados. O handler global (app.ts) converte para
 * `{ "error": { "code", "message", "details"? } }` com o status HTTP correto.
 *
 * Construtor aceita as duas ordens para facilitar o uso entre módulos:
 *   new AppError(404, 'NOT_FOUND', 'Oferta não encontrada')
 *   new AppError('NOT_FOUND', 'Oferta não encontrada', 404)
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown);
  constructor(code: string, message: string, status?: number, details?: unknown);
  constructor(a: number | string, b: string, c?: string | number, d?: unknown) {
    const numericFirst = typeof a === 'number';
    const status = numericFirst ? a : typeof c === 'number' ? c : 400;
    const code = numericFirst ? b : a;
    const message = numericFirst ? String(c ?? '') : b;
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = d;
  }

  /** Compatível com o Fastify (que lê `statusCode`). */
  get statusCode(): number {
    return this.status;
  }

  toJSON(): { error: { code: string; message: string; details?: unknown } } {
    const error: { code: string; message: string; details?: unknown } = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflito com o estado atual do recurso.', code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}
export class TooManyRequestsError extends AppError {
  readonly retryAfterSeconds?: number;
  constructor(message = 'Muitas requisições. Tente novamente em instantes.', code = 'RATE_LIMITED', retryAfterSeconds?: number) {
    super(429, code, message);
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type PublishBlockCode =
  | 'NO_VALIDATED_LINK'
  | 'OFFER_NOT_APPROVED'
  | 'DUPLICATE'
  | 'OUT_OF_WINDOW'
  | 'LIMIT_REACHED'
  | 'CHANNEL_DISABLED'
  | 'STALE_PRICE'
  | 'SUSPENDED_PRODUCT';

const PUBLISH_BLOCK_MESSAGES: Record<PublishBlockCode, string> = {
  NO_VALIDATED_LINK: 'Publicação bloqueada: o produto não tem link de afiliado validado.',
  OFFER_NOT_APPROVED: 'Publicação bloqueada: a oferta não está aprovada.',
  DUPLICATE: 'Publicação bloqueada: esta oferta já foi enfileirada ou publicada neste canal.',
  OUT_OF_WINDOW: 'Publicação bloqueada: fora da janela permitida (horário de silêncio ou intervalo mínimo).',
  LIMIT_REACHED: 'Publicação bloqueada: limite de publicações atingido.',
  CHANNEL_DISABLED: 'Publicação bloqueada: o canal está desabilitado.',
  STALE_PRICE: 'Publicação bloqueada: o preço mudou desde a descoberta; revalide a oferta.',
  SUSPENDED_PRODUCT: 'Publicação bloqueada: o produto está suspenso.',
};

/** Publicação não permitida pelas regras do produto (HTTP 409 com `code` específico). */
export class PublishBlockedError extends AppError {
  readonly blockCode: PublishBlockCode;
  constructor(code: PublishBlockCode, message?: string, details?: unknown) {
    super(409, code, message ?? PUBLISH_BLOCK_MESSAGES[code], details);
    this.blockCode = code;
  }
}

// ---- Validação de entrada com zod -------------------------------------------------

export interface ValidationIssue {
  path: string;
  message: string;
}

type ZodIssueLike = {
  code: string;
  path: PropertyKey[];
  message: string;
  keys?: string[];
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  expected?: string;
  format?: string;
  values?: unknown[];
  /** presente quando o parse usou `reportInput` */
  input?: unknown;
};

function issueMessagePt(i: ZodIssueLike): string {
  const missing = ('input' in i && i.input === undefined) || /received undefined/.test(i.message);
  switch (i.code) {
    case 'invalid_type':
      return missing ? 'campo obrigatório' : `tipo inválido (esperado ${i.expected ?? 'outro tipo'})`;
    case 'unrecognized_keys':
      return `campo(s) desconhecido(s): ${(i.keys ?? []).join(', ')}`;
    case 'too_small':
      return i.origin === 'string' || i.origin === 'array'
        ? `tamanho mínimo: ${i.minimum}`
        : `valor mínimo: ${i.minimum}`;
    case 'too_big':
      return i.origin === 'string' || i.origin === 'array'
        ? `tamanho máximo: ${i.maximum}`
        : `valor máximo: ${i.maximum}`;
    case 'invalid_format':
      return i.format === 'email' ? 'e-mail inválido' : 'formato inválido';
    case 'invalid_value':
      if (missing) return 'campo obrigatório';
      return `valor inválido (permitidos: ${(i.values ?? []).join(', ')})`;
    default:
      return i.message; // 'custom' etc. já vêm em pt-BR dos nossos refinamentos
  }
}

export function formatZodIssues(error: { issues: readonly unknown[] }): ValidationIssue[] {
  return (error.issues as ZodIssueLike[]).map((i) => ({
    path: i.path.map(String).join('.'),
    message: issueMessagePt(i),
  }));
}

/** Valida `data` com o schema zod; lança ValidationError (400) com os campos inválidos. */
export function parseInput<S extends ZodType>(schema: S, data: unknown, message = 'Dados inválidos.'): z.output<S> {
  const r = schema.safeParse(data, { reportInput: true }); // reportInput: distingue campo ausente de inválido
  if (!r.success) throw new ValidationError(message, formatZodIssues(r.error));
  return r.data;
}
