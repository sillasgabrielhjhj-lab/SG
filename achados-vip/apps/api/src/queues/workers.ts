/**
 * Workers BullMQ: discovery, publish (tick + envio avulso) e maintenance (manutenção + saúde).
 * - Concorrência 1 por fila (um tick/descoberta por vez); a idempotência do envio vem do lock em services/publishing.
 * - Cada execução de tick/manutenção/saúde atualiza ScheduledJob (status, duração, erro, heartbeat a cada 15 s).
 *   A descoberta atualiza o próprio ScheduledJob dentro de runDiscovery.
 * - Falha final de um job => ScheduledJob.lastError + SystemLog + Notification (deduplicada).
 */
import type { Prisma } from '@prisma/client';
import { Worker, type Job, type Processor } from 'bullmq';
import type { Redis } from 'ioredis';
import { cleanError } from '../adapters/publishers/common.js';
import { prisma } from '../lib/db.js';
import { PublishBlockedError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { createRedisConnection } from '../lib/redis.js';
import { HOUR_MS, MINUTE_MS } from '../lib/time.js';
import { applyChannelHealth, runHealth, syncManualChannelStatus, testSource } from '../services/channels.js';
import { runDiscovery } from '../services/discovery.js';
import { purgeExpiredSessions } from '../services/auth.js';
import { logEvent, purgeOldLogs } from '../services/logs.js';
import { expireStaleManualQueue, processDue, sendPublication } from '../services/publishing.js';
import { getSettings } from '../services/settings.js';
import { JOB, QUEUE_PREFIX, type JobName, type QueueName, type SendJobData, type TickJobData } from './queues.js';
import { markStuckJobs, releaseStuckPublications } from './recovery.js';
import { notify } from '../services/notifications.js';

export const JOB_HEARTBEAT_MS = 15_000;

const TRACKED: readonly string[] = [JOB.discovery, JOB.publishTick, JOB.maintenance, JOB.health];

const asObject = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Executa `fn` registrando em ScheduledJob: RUNNING + heartbeat -> SUCCEEDED/FAILED (com duração, erro e estatísticas).
 * As estatísticas novas são mescladas às anteriores (chaves não retornadas, como lastPurgeAt, são preservadas).
 */
export async function runTracked<T extends Record<string, unknown>>(name: JobName, queue: QueueName, fn: () => Promise<T>): Promise<T> {
  const started = new Date();
  const row = await prisma.scheduledJob.upsert({
    where: { name },
    create: { name, queue, status: 'RUNNING', lastRunAt: started, heartbeatAt: started },
    update: { status: 'RUNNING', lastRunAt: started, heartbeatAt: started },
  });
  const beat = setInterval(() => {
    void prisma.scheduledJob.updateMany({ where: { name, status: 'RUNNING' }, data: { heartbeatAt: new Date() } }).catch(() => undefined);
  }, JOB_HEARTBEAT_MS);
  beat.unref();
  const nextRunAt = (from: Date): Date | null => (row.enabled && row.everyMs ? new Date(from.getTime() + row.everyMs) : null);
  try {
    const result = await fn();
    const finished = new Date();
    await prisma.scheduledJob.update({
      where: { name },
      data: {
        status: 'SUCCEEDED',
        lastSuccessAt: finished,
        lastDurationMs: finished.getTime() - started.getTime(),
        lastError: null,
        runCount: { increment: 1 },
        heartbeatAt: null,
        nextRunAt: nextRunAt(finished),
        lastStats: { ...asObject(row.lastStats), ...result } as Prisma.InputJsonValue,
      },
    });
    return result;
  } catch (err) {
    const finished = new Date();
    await prisma.scheduledJob
      .update({
        where: { name },
        data: {
          status: 'FAILED',
          lastError: cleanError(err, 1000),
          lastDurationMs: finished.getTime() - started.getTime(),
          runCount: { increment: 1 },
          failCount: { increment: 1 },
          heartbeatAt: null,
          nextRunAt: nextRunAt(finished),
        },
      })
      .catch(() => undefined);
    throw err;
  } finally {
    clearInterval(beat);
  }
}

// ---------- manutenção ----------

export interface MaintenanceResult extends Record<string, unknown> {
  stuckJobs: number;
  releasedPublications: number;
  expiredManualQueue: number;
  expiredSessions: number;
  purged: { logs: number; priceHistory: number } | null;
  lastPurgeAt: string | null;
}

/** Retenção (no máximo 1x/hora), sessões expiradas, jobs e publicações travados, fila manual vencida. */
export async function runMaintenance(now = new Date()): Promise<MaintenanceResult> {
  const settings = await getSettings();
  const stuckJobs = (await markStuckJobs(settings.alerts.stuckJobMinutes * MINUTE_MS, now)).length;
  const releasedPublications = await releaseStuckPublications(settings.alerts.stuckPublicationMinutes * MINUTE_MS, now);
  const expiredManualQueue = await expireStaleManualQueue(now);
  await syncManualChannelStatus();
  const expiredSessions = await purgeExpiredSessions(now);

  const prev = await prisma.scheduledJob.findUnique({ where: { name: JOB.maintenance }, select: { lastStats: true } });
  const lastPurge = asObject(prev?.lastStats).lastPurgeAt;
  const dueForPurge = typeof lastPurge !== 'string' || now.getTime() - Date.parse(lastPurge) >= HOUR_MS || Number.isNaN(Date.parse(lastPurge));
  let purged: MaintenanceResult['purged'] = null;
  let lastPurgeAt = typeof lastPurge === 'string' ? lastPurge : null;
  if (dueForPurge) {
    const logs = await purgeOldLogs(settings.retention.logDays, now);
    const ph = await prisma.priceHistory.deleteMany({ where: { observedAt: { lt: new Date(now.getTime() - settings.retention.priceHistoryDays * 24 * HOUR_MS) } } });
    purged = { logs, priceHistory: ph.count };
    lastPurgeAt = now.toISOString();
  }
  return { stuckJobs, releasedPublications, expiredManualQueue, expiredSessions, purged, lastPurgeAt };
}

export interface HealthJobResult extends Record<string, unknown> {
  channels: number;
  connected: number;
  problems: number;
  source: { status: string; detail: string; checkedAt: string } | null;
}

/** Testa canais automáticos habilitados e a fonte; atualiza status e emite/resolve alertas. */
export async function runHealthChecks(now = new Date()): Promise<HealthJobResult> {
  const settings = await getSettings();
  const channels = await prisma.publishingChannel.findMany({ where: { enabled: true, type: { not: 'WHATSAPP_MANUAL_QUEUE' } }, orderBy: { createdAt: 'asc' } });
  let connected = 0;
  let problems = 0;
  for (const channel of channels) {
    try {
      const result = await runHealth(channel.type, channel.config, channel.credentialId);
      await applyChannelHealth(channel, result, now);
      if (result.status === 'CONNECTED') connected++;
      else problems++;
    } catch (err) {
      problems++;
      await logEvent('ERROR', 'health', `Falha ao testar o canal "${channel.name}"`, { channelId: channel.id, err });
    }
  }
  let source: HealthJobResult['source'] = null;
  if (settings.monitoring.enabled) {
    const r = await testSource();
    source = { status: r.status, detail: r.detail, checkedAt: now.toISOString() };
  }
  return { channels: channels.length, connected, problems, source };
}

// ---------- processadores ----------

const discoveryProcessor: Processor<TickJobData> = async (job) => {
  const settings = await getSettings();
  if (job.data?.trigger === 'schedule' && !settings.monitoring.enabled) return { skipped: 'monitoramento desabilitado' };
  try {
    return await runDiscovery();
  } catch (err) {
    // runDiscovery trata quase tudo; isto cobre falhas inesperadas (ex.: banco fora do ar no início)
    await prisma.scheduledJob
      .updateMany({ where: { name: JOB.discovery }, data: { status: 'FAILED', lastError: cleanError(err, 1000), failCount: { increment: 1 }, heartbeatAt: null } })
      .catch(() => undefined);
    throw err;
  }
};

const publishProcessor: Processor<TickJobData | SendJobData> = async (job) => {
  if (job.name === JOB.sendPublication) {
    try {
      const pub = await sendPublication((job.data as SendJobData).publicationId);
      return { status: pub.status };
    } catch (err) {
      if (err instanceof PublishBlockedError) return { held: err.blockCode }; // trava dura: a publicação aguarda
      throw err;
    }
  }
  return runTracked(JOB.publishTick, 'publish', () => processDue() as unknown as Promise<Record<string, unknown>>);
};

const maintenanceProcessor: Processor<TickJobData> = async (job) =>
  job.name === JOB.health ? runTracked(JOB.health, 'maintenance', () => runHealthChecks()) : runTracked(JOB.maintenance, 'maintenance', () => runMaintenance());

async function onJobFailed(queue: QueueName, job: Job | undefined, err: Error): Promise<void> {
  const name = job?.name ?? 'desconhecido';
  const attempts = job?.opts.attempts ?? 1;
  const made = job?.attemptsMade ?? attempts;
  const final = made >= attempts;
  const message = cleanError(err, 1000);
  await logEvent(final ? 'ERROR' : 'WARN', 'queues', `Job "${name}" falhou (tentativa ${made}/${attempts}): ${message}`, { queue, jobId: job?.id ?? null, final });
  if (!final) return;
  if (TRACKED.includes(name)) {
    await prisma.scheduledJob.updateMany({ where: { name }, data: { status: 'FAILED', lastError: message, heartbeatAt: null } }).catch(() => undefined);
  }
  if (name !== JOB.sendPublication) {
    await notify({ level: 'ERROR', type: 'job_failed', title: `Tarefa "${name}" falhou`, body: message, dedupeKey: `job-failed:${name}` });
  }
}

export interface WorkerHandle {
  close(): Promise<void>;
  workers: Worker[];
}

/** Inicia os workers (cada um com sua própria conexão Redis). */
export function startWorkers(): WorkerHandle {
  const connections: Redis[] = [];
  const make = <D>(queue: Exclude<QueueName, 'dead-letter'>, processor: Processor<D>): Worker<D> => {
    const connection = createRedisConnection('bullmq');
    connections.push(connection);
    const worker = new Worker<D>(queue, processor, { connection, prefix: QUEUE_PREFIX, concurrency: 1, lockDuration: 60_000 });
    worker.on('failed', (job, err) => void onJobFailed(queue, job, err));
    worker.on('error', (err) => logger.warn({ err: { message: err.message }, queue }, 'erro no worker BullMQ'));
    return worker;
  };
  const workers: Worker[] = [
    make<TickJobData>('discovery', discoveryProcessor),
    make<TickJobData | SendJobData>('publish', publishProcessor),
    make<TickJobData>('maintenance', maintenanceProcessor),
  ] as Worker[];
  return {
    workers,
    async close() {
      await Promise.allSettled(workers.map((w) => w.close())); // aguarda os jobs em andamento terminarem
      await Promise.allSettled(
        connections.map(async (c) => {
          try {
            await c.quit();
          } catch {
            c.disconnect();
          }
        }),
      );
    },
  };
}
