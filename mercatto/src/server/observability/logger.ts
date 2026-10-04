import "server-only";

/**
 * Logger estruturado (JSON em produção, legível em desenvolvimento).
 * Campos sensíveis são removidos automaticamente antes de registrar.
 * Pode ser conectado a Sentry/Datadog/Axiom substituindo `sink`.
 */
type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEYS = /pass(word)?|secret|token|authorization|cookie|card|cvv|cvc|pan|cpf|document|hash/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: process.env.NODE_ENV !== "production" ? value.stack : undefined };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

const minLevel = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;
const pretty = process.env.NODE_ENV !== "production";

function sink(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (LEVELS[level] < minLevel) return;
  const entry = { level, msg, time: new Date().toISOString(), ...(ctx ? (redact(ctx) as object) : {}) };
  const line = pretty ? `[${level.toUpperCase()}] ${msg}${ctx ? " " + JSON.stringify(redact(ctx)) : ""}` : JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => sink("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => sink("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => sink("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => sink("error", msg, ctx),
};
