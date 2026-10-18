import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Variáveis de ambiente validadas.
 * - Em NODE_ENV != production, segredos ausentes recebem defaults INSEGUROS de desenvolvimento (avisados em `warnings`).
 * - Em production, a ausência de qualquer segredo derruba a inicialização (EnvError lista só os NOMES, nunca valores).
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const booleanish = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return s === '' ? undefined : v;
}, z.boolean().optional());

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: optionalString,
  REDIS_URL: optionalString,
  APP_ENCRYPTION_KEY: optionalString,
  SESSION_SECRET: optionalString,
  COOKIE_SECURE: booleanish,
  TRUST_PROXY: booleanish,
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3001)),
  HOST: z.preprocess(emptyToUndefined, z.string().default('0.0.0.0')),
  WEB_ORIGIN: z.preprocess(emptyToUndefined, z.url().optional()),
  ML_CLIENT_ID: optionalString,
  ML_CLIENT_SECRET: optionalString,
  ML_REFRESH_TOKEN: optionalString,
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  ),
});

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  isProduction: boolean;
  isTest: boolean;
  DATABASE_URL: string;
  REDIS_URL: string;
  /** base64 de 32 bytes */
  APP_ENCRYPTION_KEY: string;
  /** chave AES-256 decodificada (32 bytes) */
  encryptionKey: Buffer;
  SESSION_SECRET: string;
  COOKIE_SECURE: boolean;
  /** true somente atrás de proxy reverso confiável (Caddy): habilita X-Forwarded-For. */
  TRUST_PROXY: boolean;
  PORT: number;
  HOST: string;
  /** Origem pública do painel. Se definida, mutações com header Origin diferente são recusadas. */
  WEB_ORIGIN?: string;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
  ML_REFRESH_TOKEN?: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** Avisos de configuração (ex.: defaults de desenvolvimento em uso). */
  warnings: string[];
}

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuração de ambiente inválida:\n - ${problems.join('\n - ')}`);
    this.name = 'EnvError';
  }
}

const DEV_ENCRYPTION_KEY = createHash('sha256').update('achados-vip:dev-only-encryption-key:v1').digest('base64');
const DEV_SESSION_SECRET = 'dev-only-session-secret-not-for-production-0123456789';
const PLACEHOLDER_RE = /^(change[-_ ]?me|changeme|secret|password|example|todo|xxx+)/i;

/** 32 bytes em base64 padrão = 43 caracteres + "=". */
function decodeKey(b64: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(b64)) return null;
  const buf = Buffer.from(b64, 'base64');
  return buf.length === 32 ? buf : null;
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = RawEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: valor inválido`));
  }
  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  const need = (name: string, value: string | undefined, devDefault: string): string => {
    if (value !== undefined) return value;
    if (isProduction) {
      problems.push(`${name} é obrigatória em produção`);
      return '';
    }
    warnings.push(`${name} ausente: usando valor padrão de DESENVOLVIMENTO (inseguro)`);
    return devDefault;
  };

  const DATABASE_URL = need('DATABASE_URL', raw.DATABASE_URL, 'postgresql://achados:achados@localhost:5432/achados');
  const REDIS_URL = need('REDIS_URL', raw.REDIS_URL, 'redis://localhost:6379');
  const APP_ENCRYPTION_KEY = need('APP_ENCRYPTION_KEY', raw.APP_ENCRYPTION_KEY, DEV_ENCRYPTION_KEY);
  const SESSION_SECRET = need('SESSION_SECRET', raw.SESSION_SECRET, DEV_SESSION_SECRET);

  let encryptionKey: Buffer = Buffer.alloc(0);
  if (APP_ENCRYPTION_KEY) {
    const k = decodeKey(APP_ENCRYPTION_KEY);
    if (!k) problems.push('APP_ENCRYPTION_KEY deve ser base64 de exatamente 32 bytes (gere com: openssl rand -base64 32)');
    else encryptionKey = k;
  }
  if (isProduction && SESSION_SECRET) {
    if (SESSION_SECRET.length < 32) problems.push('SESSION_SECRET deve ter ao menos 32 caracteres');
    if (PLACEHOLDER_RE.test(SESSION_SECRET)) problems.push('SESSION_SECRET parece um valor de exemplo');
  }

  const COOKIE_SECURE = raw.COOKIE_SECURE ?? isProduction;
  if (isProduction && !COOKIE_SECURE) warnings.push('COOKIE_SECURE=false em produção: cookie de sessão sem flag Secure');

  if (problems.length) throw new EnvError(problems);

  const env: Env = {
    NODE_ENV: raw.NODE_ENV,
    isProduction,
    isTest: raw.NODE_ENV === 'test',
    DATABASE_URL,
    REDIS_URL,
    APP_ENCRYPTION_KEY,
    encryptionKey,
    SESSION_SECRET,
    COOKIE_SECURE,
    TRUST_PROXY: raw.TRUST_PROXY ?? false,
    PORT: raw.PORT,
    HOST: raw.HOST,
    LOG_LEVEL: raw.LOG_LEVEL ?? (raw.NODE_ENV === 'test' ? 'silent' : 'info'),
    warnings,
  };
  if (raw.WEB_ORIGIN !== undefined) env.WEB_ORIGIN = new URL(raw.WEB_ORIGIN).origin;
  if (raw.ML_CLIENT_ID !== undefined) env.ML_CLIENT_ID = raw.ML_CLIENT_ID;
  if (raw.ML_CLIENT_SECRET !== undefined) env.ML_CLIENT_SECRET = raw.ML_CLIENT_SECRET;
  if (raw.ML_REFRESH_TOKEN !== undefined) env.ML_REFRESH_TOKEN = raw.ML_REFRESH_TOKEN;
  return env;
}

/** Em desenvolvimento, carrega `.env` do diretório atual (sem sobrescrever variáveis já definidas). */
function loadDotenvForDevelopment(): void {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  try {
    process.loadEnvFile('.env');
  } catch {
    // sem .env (ou Node antigo): segue só com o ambiente
  }
}
loadDotenvForDevelopment();

export const env: Env = loadEnv();
