import { Prisma, type LogLevel } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { logger, scrubString } from '../lib/logger.js';

export interface NotifyInput {
  level?: LogLevel | Lowercase<LogLevel>;
  /** ex.: "integration_auth_required", "job_stuck" */
  type: string;
  title: string;
  body?: string;
  /** Alertas com a mesma chave não se repetem enquanto houver um NÃO LIDO. */
  dedupeKey?: string;
}

export interface NotificationDTO {
  id: string;
  level: LogLevel;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Cria um alerta no painel. Com `dedupeKey`, ignora se já existe um não lido com a mesma chave.
 * Nunca lança (alertas não podem quebrar o fluxo que os gerou).
 */
export async function notify(n: NotifyInput): Promise<void> {
  const level = (n.level ?? 'WARN').toUpperCase() as LogLevel;
  const title = scrubString(n.title).slice(0, 200);
  const body = n.body ? scrubString(n.body).slice(0, 2000) : null;
  try {
    if (n.dedupeKey) {
      const existing = await prisma.notification.findUnique({ where: { dedupeKey: n.dedupeKey } });
      if (existing && existing.readAt === null) return; // já há um alerta não lido
      if (existing) {
        // lido anteriormente (chave única): reabre como novo alerta
        await prisma.notification.update({
          where: { id: existing.id },
          data: { level, type: n.type, title, body, readAt: null, createdAt: new Date() },
        });
        return;
      }
    }
    await prisma.notification.create({
      data: { level, type: n.type, title, body, dedupeKey: n.dedupeKey ?? null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return; // corrida: outro processo criou
    logger.error({ err, type: n.type }, 'falha ao criar notificação');
  }
}

const toDTO = (r: { id: string; level: LogLevel; type: string; title: string; body: string | null; readAt: Date | null; createdAt: Date }): NotificationDTO => ({
  id: r.id,
  level: r.level,
  type: r.type,
  title: r.title,
  body: r.body,
  read: r.readAt !== null,
  createdAt: r.createdAt.toISOString(),
});

export async function listNotifications(opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationDTO[]> {
  const rows = await prisma.notification.findMany({
    where: opts.unreadOnly ? { readAt: null } : {},
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 50, 200),
  });
  return rows.map(toDTO);
}

export const countUnread = (): Promise<number> => prisma.notification.count({ where: { readAt: null } });

/** Marca como lida; devolve false se não existir. */
export async function markRead(id: string): Promise<boolean> {
  const res = await prisma.notification.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
  if (res.count > 0) return true;
  return (await prisma.notification.count({ where: { id } })) > 0;
}

export async function markAllRead(): Promise<number> {
  return (await prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } })).count;
}

/** Marca como lido o alerta de uma condição que deixou de existir (ex.: integração voltou a funcionar). */
export async function resolveByKey(dedupeKey: string): Promise<void> {
  await prisma.notification.updateMany({ where: { dedupeKey, readAt: null }, data: { readAt: new Date() } });
}
