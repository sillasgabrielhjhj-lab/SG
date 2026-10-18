import type { LogLevel, Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { logger, sanitizeForLog, scrubString } from '../lib/logger.js';
import { pageParams, pageResult, type Page } from '../lib/pagination.js';

export type LogLevelInput = LogLevel | Lowercase<LogLevel>;

export interface SystemLogDTO {
  id: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta: unknown;
  createdAt: string;
}

const MAX_MESSAGE = 2000;
const MAX_META_JSON = 16_000;

/** Sanitiza `meta`: segredos viram [REDACTED]; tamanho limitado. */
function safeMeta(meta: unknown): Prisma.InputJsonValue | undefined {
  if (meta === undefined || meta === null) return undefined;
  const clean = sanitizeForLog(meta);
  const json = JSON.stringify(clean);
  if (json.length > MAX_META_JSON) return { truncated: true, preview: json.slice(0, 2000) };
  return clean as Prisma.InputJsonValue;
}

/**
 * Grava um evento em SystemLog (e espelha no logger de processo). Nunca lança:
 * falha ao gravar log não pode derrubar o fluxo de negócio.
 */
export async function logEvent(level: LogLevelInput, scope: string, message: string, meta?: unknown): Promise<void> {
  const lvl = level.toUpperCase() as LogLevel;
  const cleanMessage = scrubString(message).slice(0, MAX_MESSAGE);
  const cleanMeta = safeMeta(meta);
  const fn = lvl === 'ERROR' ? 'error' : lvl === 'WARN' ? 'warn' : lvl === 'DEBUG' ? 'debug' : 'info';
  logger[fn]({ scope, meta: cleanMeta }, cleanMessage);
  try {
    await prisma.systemLog.create({
      data: { level: lvl, scope: scope.slice(0, 100), message: cleanMessage, ...(cleanMeta !== undefined ? { meta: cleanMeta } : {}) },
    });
  } catch (err) {
    logger.error({ err }, 'falha ao gravar SystemLog');
  }
}

export interface ListLogsQuery {
  level?: LogLevel;
  scope?: string;
  page: number;
  pageSize: number;
}

export async function listLogs(q: ListLogsQuery): Promise<Page<SystemLogDTO>> {
  const where: Prisma.SystemLogWhereInput = {
    ...(q.level ? { level: q.level } : {}),
    ...(q.scope ? { scope: q.scope } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.systemLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageParams(q) }),
    prisma.systemLog.count({ where }),
  ]);
  return pageResult(
    rows.map((r) => ({ id: r.id, level: r.level, scope: r.scope, message: r.message, meta: r.meta, createdAt: r.createdAt.toISOString() })),
    total,
    q,
  );
}

/** Remove logs mais antigos que `days` (manutenção). Devolve a quantidade removida. */
export async function purgeOldLogs(days: number, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const res = await prisma.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}
