import { isDeepStrictEqual } from 'node:util';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { ValidationError, formatZodIssues, type ValidationIssue } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isValidTimeZone } from '../lib/time.js';
import { defaultSettings, SettingsSchema, type Settings } from '../domain/settings.js';
import { recordAudit } from './audit.js';

export type DeepPartial<T> = T extends (infer U)[] ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

const CACHE_TTL_MS = 5000;
let cache: { value: Settings; expiresAt: number } | null = null;

/** Descarta o cache em memória (usado em testes e após atualizações). */
export function clearSettingsCache(): void {
  cache = null;
}

const clone = <T>(v: T): T => structuredClone(v);
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const HOST_RE = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

function parseStored(data: unknown): Settings {
  const r = SettingsSchema.safeParse(data);
  if (r.success) return r.data;
  // Dado corrompido/antigo: volta aos padrões SEGUROS (autoPublish=false) e avisa.
  logger.error({ issues: formatZodIssues(r.error) }, 'configurações salvas inválidas; usando padrões');
  return defaultSettings();
}

/** Cria a linha singleton com os padrões se não existir (atômico: seguro com chamadas concorrentes). */
async function ensureRow(client: PrismaClient | Prisma.TransactionClient): Promise<void> {
  await client.$executeRaw`INSERT INTO "AutomationSettings" ("id", "data", "updatedAt")
    VALUES (1, ${JSON.stringify(defaultSettings())}::jsonb, NOW()) ON CONFLICT ("id") DO NOTHING`;
}

/** Configurações atuais (cache de 5s; cria a linha singleton com os padrões se não existir). */
export async function getSettings(): Promise<Settings> {
  const nowMs = Date.now();
  if (cache && cache.expiresAt > nowMs) return clone(cache.value);
  let row = await prisma.automationSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    await ensureRow(prisma);
    row = await prisma.automationSettings.findUniqueOrThrow({ where: { id: 1 } });
  }
  const value = parseStored(row.data);
  cache = { value, expiresAt: nowMs + CACHE_TTL_MS };
  return clone(value);
}

/** Chaves do patch que não existem em Settings (para recusar em vez de ignorar em silêncio). */
function findUnknownKeys(patch: Record<string, unknown>, current: Record<string, unknown>, prefix = ''): string[] {
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const path = prefix + key;
    if (!Object.hasOwn(current, key)) {
      unknown.push(path);
      continue;
    }
    const cur = current[key];
    if (isPlainObject(value) && isPlainObject(cur)) unknown.push(...findUnknownKeys(value, cur, `${path}.`));
  }
  return unknown;
}

/** Merge profundo: objetos mesclam, arrays e escalares substituem. */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const cur = out[key];
    out[key] = isPlainObject(value) && isPlainObject(cur) ? deepMerge(cur, value) : value;
  }
  return out;
}

/** Regras entre campos que o schema base não cobre. */
function checkInvariants(s: Settings): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = s.scoring.thresholds;
  if (!(t.exceptional > t.excellent && t.excellent > t.good)) {
    issues.push({ path: 'scoring.thresholds', message: 'os limites devem seguir: excepcional > excelente > bom' });
  }
  const sum = Object.values(s.scoring.weights).reduce((a, b) => a + b, 0);
  if (!(sum > 0)) issues.push({ path: 'scoring.weights', message: 'a soma dos pesos deve ser maior que zero' });
  const q = s.publishing.quietHours;
  if (!isValidTimeZone(q.timezone)) issues.push({ path: 'publishing.quietHours.timezone', message: 'fuso horário inválido' });
  if (q.enabled && q.start === q.end) issues.push({ path: 'publishing.quietHours', message: 'início e fim do horário de silêncio devem ser diferentes' });
  const hosts = s.affiliate.allowedHosts;
  if (hosts.length === 0) issues.push({ path: 'affiliate.allowedHosts', message: 'informe ao menos um domínio permitido' });
  hosts.forEach((h, i) => {
    if (!HOST_RE.test(h)) issues.push({ path: `affiliate.allowedHosts.${i}`, message: `domínio inválido: ${h}` });
  });
  return issues;
}

function normalize(s: Settings): Settings {
  s.affiliate.allowedHosts = [...new Set(s.affiliate.allowedHosts.map((h) => h.trim().toLowerCase()))];
  return s;
}

/**
 * Aplica um patch PARCIAL e profundo, valida o resultado e grava com auditoria (before/after).
 * Chaves desconhecidas e valores inválidos são recusados (ValidationError 400).
 */
export async function updateSettings(patch: DeepPartial<Settings>, userId?: string, ip?: string | null): Promise<Settings> {
  if (!isPlainObject(patch)) throw new ValidationError('O corpo deve ser um objeto com as configurações a alterar.');

  const result = await prisma.$transaction(async (tx) => {
    await ensureRow(tx);
    // trava a linha: dois PUTs simultâneos não perdem alterações um do outro
    await tx.$queryRaw`SELECT id FROM "AutomationSettings" WHERE id = 1 FOR UPDATE`;
    const row = await tx.automationSettings.findUniqueOrThrow({ where: { id: 1 } });
    const before = parseStored(row.data);

    const unknown = findUnknownKeys(patch, before as unknown as Record<string, unknown>);
    if (unknown.length) {
      throw new ValidationError(
        'Configurações inválidas.',
        unknown.map((path) => ({ path, message: 'campo desconhecido' })),
      );
    }
    const parsed = SettingsSchema.safeParse(deepMerge(before as unknown as Record<string, unknown>, patch));
    if (!parsed.success) throw new ValidationError('Configurações inválidas.', formatZodIssues(parsed.error));
    const after = normalize(parsed.data);
    const issues = checkInvariants(after);
    if (issues.length) throw new ValidationError('Configurações inválidas.', issues);

    if (isDeepStrictEqual(before, after)) return after; // nada mudou: sem escrita nem auditoria

    await tx.automationSettings.update({
      where: { id: 1 },
      data: { data: after as unknown as Prisma.InputJsonValue, updatedBy: userId ?? null },
    });
    await recordAudit(
      { userId: userId ?? null, action: 'settings.update', entity: 'AutomationSettings', entityId: '1', before, after, ip: ip ?? null },
      tx,
    );
    return after;
  });

  clearSettingsCache();
  return clone(result);
}
