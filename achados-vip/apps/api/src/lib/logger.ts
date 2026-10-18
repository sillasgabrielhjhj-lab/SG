import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { env } from './env.js';

export const REDACTED = '[REDACTED]';

/** Nomes de chave (case-insensitive, por substring) cujo VALOR nunca deve ser gravado. */
const SENSITIVE_KEY_RE =
  /(authorization|cookie|passw(or)?d|passphrase|secret|token|api[-_]?key|private[-_]?key|credential|encrypted|signature|bearer)/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

/** Remove segredos que aparecem embutidos em texto (URLs, headers, JSON serializado, mensagens de erro). */
export function scrubString(input: string): string {
  return input
    .replace(/bot(\d{6,}):[A-Za-z0-9_-]{20,}/g, 'bot[REDACTED]') // token de bot do Telegram em URLs
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [REDACTED]')
    .replace(
      /([?&;\s"'](?:access_token|refresh_token|client_secret|token|password|secret|api_key|apikey|code|key)=)[^&\s"']+/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /("(?:access_token|refresh_token|client_secret|token|password|secret|apikey|api_key)"\s*:\s*")[^"]*(")/gi,
      `$1${REDACTED}$2`,
    )
    .replace(/\b(APP_USR|TG)-[A-Za-z0-9_-]{16,}/g, `$1-${REDACTED}`) // tokens do Mercado Livre
    .replace(/\bEAA[A-Za-z0-9]{20,}/g, REDACTED) // tokens da Meta
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, REDACTED) // JWT
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, `$1${REDACTED}@`); // user:senha@host
}

export interface SanitizeOptions {
  maxDepth?: number;
  maxString?: number;
  maxArray?: number;
}

/**
 * Devolve uma cópia JSON-segura de `value` sem segredos: chaves sensíveis viram "[REDACTED]",
 * strings passam por `scrubString`, Error vira {name,message,stack}, ciclos e profundidade são limitados.
 */
export function sanitizeForLog(value: unknown, opts: SanitizeOptions = {}): unknown {
  const { maxDepth = 6, maxString = 4000, maxArray = 100 } = opts;
  const seen = new WeakSet<object>();

  const walk = (v: unknown, depth: number): unknown => {
    if (v === null || v === undefined) return v;
    switch (typeof v) {
      case 'string': {
        const s = scrubString(v);
        return s.length > maxString ? `${s.slice(0, maxString)}…[truncado]` : s;
      }
      case 'number':
        return Number.isFinite(v) ? v : String(v);
      case 'boolean':
        return v;
      case 'bigint':
        return v.toString();
      case 'function':
      case 'symbol':
        return undefined;
    }
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
    if (Buffer.isBuffer(v)) return `[Buffer ${v.length} bytes]`;
    if (depth >= maxDepth) return '[Truncated]';
    const obj = v as object;
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    try {
      if (v instanceof Error) {
        const out: Record<string, unknown> = { name: v.name, message: walk(v.message, depth + 1) };
        const code = (v as { code?: unknown }).code;
        if (typeof code === 'string' || typeof code === 'number') out.code = code;
        if (v.stack) out.stack = walk(v.stack.split('\n').slice(0, 12).join('\n'), depth + 1);
        return out;
      }
      if (Array.isArray(v)) return v.slice(0, maxArray).map((x) => walk(x, depth + 1));
      if (v instanceof Map) return walk(Object.fromEntries(v), depth);
      if (v instanceof Set) return walk([...v], depth);
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
        out[k] = isSensitiveKey(k) ? REDACTED : walk(val, depth + 1);
      }
      return out;
    } finally {
      seen.delete(obj);
    }
  };

  return walk(value, 0);
}

// Caminhos de redação nativa do pino (cinto e suspensório; o filtro principal é `formatters.log`).
const REDACT_KEYS = [
  'authorization',
  'cookie',
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'client_secret',
  'apiKey',
  'api_key',
  'encrypted',
];
const REDACT_PATHS = REDACT_KEYS.flatMap((k) => [0, 1, 2, 3].map((n) => `${'*.'.repeat(n)}${k}`));

export function buildLoggerOptions(level: string = env.LOG_LEVEL): LoggerOptions {
  return {
    level,
    base: { app: 'achados-api' },
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    serializers: {
      // `req`/`res` do Fastify: só método/url (sem headers, sem cookies, sem corpo).
      req: (req: { method?: string; url?: string; ip?: string; id?: string }) => ({
        id: req.id,
        method: req.method,
        url: typeof req.url === 'string' ? scrubString(req.url) : undefined,
        remoteAddress: req.ip,
      }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      err: (err: Error) => sanitizeForLog(pino.stdSerializers.err(err)),
    },
    formatters: {
      log(obj) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          // `req`/`res` são tratados pelos serializers acima (precisam do objeto original)
          out[k] = k === 'req' || k === 'res' || k === 'err' ? v : isSensitiveKey(k) ? REDACTED : sanitizeForLog(v);
        }
        return out;
      },
    },
    hooks: {
      logMethod(args, method) {
        // mensagem em texto: remove segredos embutidos (ex.: URL com ?access_token=...)
        const scrubbed = args.map((a) => (typeof a === 'string' ? scrubString(a) : a)) as typeof args;
        method.apply(this, scrubbed);
      },
    },
  };
}

/** Cria um logger com as mesmas regras; `destination` permite capturar a saída em testes. */
export function createLogger(destination?: DestinationStream, level?: string): Logger {
  const options = buildLoggerOptions(level);
  return destination ? pino(options, destination) : pino(options);
}

function buildDefaultLogger(): Logger {
  const options = buildLoggerOptions();
  if (env.NODE_ENV === 'development' && process.stdout.isTTY) {
    try {
      return pino({ ...options, transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } });
    } catch {
      // pino-pretty indisponível: segue com JSON
    }
  }
  return pino(options);
}

export const logger: Logger = buildDefaultLogger();
