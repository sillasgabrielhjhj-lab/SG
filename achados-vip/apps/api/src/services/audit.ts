import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { logger, sanitizeForLog } from '../lib/logger.js';
import { pageParams, pageResult, type Page } from '../lib/pagination.js';

export interface AuditEntry {
  userId?: string | null;
  /** ex.: "auth.login", "settings.update", "category.update" */
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

type Client = PrismaClient | Prisma.TransactionClient;

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : (sanitizeForLog(v, { maxDepth: 8 }) as Prisma.InputJsonValue);

/**
 * Registra uma ação auditável. `before/after` passam pelo sanitizador (segredos nunca entram).
 * Aceita um client de transação para gravar atomicamente com a mudança auditada.
 */
export async function recordAudit(entry: AuditEntry, client: Client = prisma): Promise<void> {
  const before = json(entry.before);
  const after = json(entry.after);
  await client.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      ...(before !== undefined ? { before } : {}),
      ...(after !== undefined ? { after } : {}),
      ip: entry.ip ?? null,
    },
  });
}

/** Igual a recordAudit, mas nunca lança (para eventos de login/logout, que não devem quebrar a requisição). */
export async function recordAuditSafe(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(entry);
  } catch (err) {
    logger.error({ err, action: entry.action }, 'falha ao gravar auditoria');
  }
}

export const audit = recordAudit;

export async function listAudit(q: { page: number; pageSize: number }): Promise<Page<AuditLogDTO>> {
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
      ...pageParams(q),
    }),
    prisma.auditLog.count(),
  ]);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    q,
  );
}
