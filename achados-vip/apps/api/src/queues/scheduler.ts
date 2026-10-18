/**
 * Agendadores BullMQ (upsertJobScheduler) derivados das configurações:
 *  - discovery: a cada monitoring.intervalMinutes; REMOVIDO quando monitoring.enabled = false;
 *  - publish-tick: 60 s; maintenance: 5 min; health: 5 min (sempre ativos).
 * `syncSchedules()` é idempotente: só chama upsert quando o agendador não existe ou o intervalo mudou.
 * É reaplicado (a) pela rota PUT /api/settings (notifySettingsChanged), (b) por POST /api/automation/apply e
 * (c) a cada minuto pelo worker (detecta mudanças feitas por outro processo ou com Redis recém-limpo).
 */
import type { Prisma } from '@prisma/client';
import type { Settings } from '../domain/settings.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { MINUTE_MS, withTimeout } from '../lib/time.js';
import { getSettings } from '../services/settings.js';
import { JOB, JOB_QUEUE, getQueue, schedulerJobOptions, type JobName, type TickJobData } from './queues.js';

export const PUBLISH_TICK_EVERY_MS = 60_000;
export const MAINTENANCE_EVERY_MS = 5 * MINUTE_MS;
export const HEALTH_EVERY_MS = 5 * MINUTE_MS;

type ScheduledName = typeof JOB.discovery | typeof JOB.publishTick | typeof JOB.maintenance | typeof JOB.health;

export interface ScheduleSpec {
  name: ScheduledName;
  /** null => o agendador deve estar removido. */
  everyMs: number | null;
}

export function desiredSchedules(settings: Settings): ScheduleSpec[] {
  return [
    { name: JOB.discovery, everyMs: settings.monitoring.enabled ? settings.monitoring.intervalMinutes * MINUTE_MS : null },
    { name: JOB.publishTick, everyMs: PUBLISH_TICK_EVERY_MS },
    { name: JOB.maintenance, everyMs: MAINTENANCE_EVERY_MS },
    { name: JOB.health, everyMs: HEALTH_EVERY_MS },
  ];
}

export type ScheduleAction = 'created' | 'updated' | 'unchanged' | 'removed' | 'absent';
export interface ScheduleSyncItem {
  name: ScheduledName;
  everyMs: number | null;
  action: ScheduleAction;
  nextRunAt: string | null;
}

export async function syncSchedules(): Promise<{ schedules: ScheduleSyncItem[] }> {
  const settings = await getSettings();
  const schedules: ScheduleSyncItem[] = [];
  for (const spec of desiredSchedules(settings)) {
    const queueName = JOB_QUEUE[spec.name];
    const queue = getQueue(queueName);
    const existing = await queue.getJobScheduler(spec.name);
    let action: ScheduleAction;
    let next: number | null = existing?.next ?? null;

    if (spec.everyMs === null) {
      if (existing) {
        await queue.removeJobScheduler(spec.name);
        action = 'removed';
      } else {
        action = 'absent';
      }
      next = null;
    } else if (!existing || existing.every !== spec.everyMs) {
      const job = await queue.upsertJobScheduler(
        spec.name,
        { every: spec.everyMs },
        { name: spec.name, data: { trigger: 'schedule' } satisfies TickJobData, opts: schedulerJobOptions(queueName) },
      );
      action = existing ? 'updated' : 'created';
      next = job.timestamp + (job.delay ?? 0);
    } else {
      action = 'unchanged';
    }

    const nextRunAt = next ? new Date(next) : null;
    await prisma.scheduledJob.upsert({
      where: { name: spec.name },
      create: { name: spec.name, queue: queueName, everyMs: spec.everyMs, enabled: spec.everyMs !== null, nextRunAt },
      update: { queue: queueName, everyMs: spec.everyMs, enabled: spec.everyMs !== null, nextRunAt },
    } satisfies Prisma.ScheduledJobUpsertArgs);
    schedules.push({ name: spec.name, everyMs: spec.everyMs, action, nextRunAt: nextRunAt?.toISOString() ?? null });
  }
  return { schedules };
}

/** Nome do contrato (CONTRACT.md): lê as settings e registra/atualiza os agendadores. */
export async function registerSchedules(): Promise<void> {
  await syncSchedules();
}

/**
 * Gancho para a rota PUT /api/settings: reaplica os agendadores sem bloquear nem falhar a requisição
 * (se o Redis estiver fora, o worker reaplica no próximo minuto).
 */
export function notifySettingsChanged(): void {
  void withTimeout(syncSchedules(), 5000, 'syncSchedules').catch((err) => {
    logger.warn({ err: { message: err instanceof Error ? err.message : String(err) } }, 'não foi possível reaplicar os agendadores agora; o worker reaplica em até 1 min');
  });
}

/** Nomes de jobs que têm agendador (para telas/diagnóstico). */
export const SCHEDULED_JOB_NAMES: readonly JobName[] = [JOB.discovery, JOB.publishTick, JOB.maintenance, JOB.health];
