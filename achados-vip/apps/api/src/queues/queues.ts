/**
 * Filas BullMQ (prefixo "achados"): discovery, publish, maintenance e dead-letter (DLQ).
 * As conexões são criadas sob demanda (importar este módulo não abre conexão com o Redis) e
 * `closeQueues()` encerra tudo. Quem cria a conexão é responsável por fechá-la.
 */
import { randomUUID } from 'node:crypto';
import { Queue, type JobsOptions, type JobSchedulerTemplateOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection } from '../lib/redis.js';

export const QUEUE_PREFIX = 'achados';

export const QUEUE_NAMES = ['discovery', 'publish', 'maintenance', 'dead-letter'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

/** Nomes dos jobs (e dos agendadores) — também são as chaves de ScheduledJob.name. */
export const JOB = {
  discovery: 'discovery',
  publishTick: 'publish-tick',
  sendPublication: 'send-publication',
  maintenance: 'maintenance',
  health: 'health',
} as const;
export type JobName = (typeof JOB)[keyof typeof JOB];

/** Fila de cada job. */
export const JOB_QUEUE: Record<JobName, QueueName> = {
  discovery: 'discovery',
  'publish-tick': 'publish',
  'send-publication': 'publish',
  maintenance: 'maintenance',
  health: 'maintenance',
};

export interface TickJobData {
  trigger: 'schedule' | 'manual' | 'boot';
  requestedBy?: string;
}
export interface SendJobData {
  publicationId: string;
}
export interface DeadLetterData {
  publicationId: string;
  offerId: string;
  channelId: string;
  channelName: string;
  productTitle: string;
  attempts: number;
  error: string;
  deadAt: string;
}

/** Retentativas do BullMQ por fila (a retentativa de ENVIO tem backoff próprio, em services/publishing). */
const DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  discovery: { attempts: 2, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: { age: 3600, count: 50 }, removeOnFail: { age: 7 * 86400, count: 200 } },
  publish: { attempts: 1, removeOnComplete: { age: 600, count: 50 }, removeOnFail: { age: 7 * 86400, count: 200 } },
  maintenance: { attempts: 2, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: { age: 3600, count: 50 }, removeOnFail: { age: 7 * 86400, count: 200 } },
  'dead-letter': { attempts: 1, removeOnComplete: false, removeOnFail: false },
};

/** Opções aplicadas aos jobs gerados pelos agendadores (upsertJobScheduler). */
export function schedulerJobOptions(queue: QueueName): JobSchedulerTemplateOptions {
  const { attempts, backoff, removeOnComplete, removeOnFail } = DEFAULT_JOB_OPTIONS[queue];
  return { ...(attempts !== undefined ? { attempts } : {}), ...(backoff !== undefined ? { backoff } : {}), ...(removeOnComplete !== undefined ? { removeOnComplete } : {}), ...(removeOnFail !== undefined ? { removeOnFail } : {}) } as JobSchedulerTemplateOptions;
}

let sharedConnection: Redis | null = null;
const queues = new Map<QueueName, Queue>();

/** Conexão compartilhada das Filas (produtores). Workers criam conexões próprias. */
export function getQueueConnection(): Redis {
  sharedConnection ??= createRedisConnection('bullmq');
  return sharedConnection;
}

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getQueueConnection(), prefix: QUEUE_PREFIX, defaultJobOptions: DEFAULT_JOB_OPTIONS[name] });
    q.on('error', () => undefined); // erros de conexão já são logados por lib/redis
    queues.set(name, q);
  }
  return q;
}

export async function closeQueues(): Promise<void> {
  const open = [...queues.values()];
  queues.clear();
  await Promise.allSettled(open.map((q) => q.close()));
  const conn = sharedConnection;
  sharedConnection = null;
  if (conn) {
    try {
      await conn.quit();
    } catch {
      conn.disconnect();
    }
  }
}

/**
 * Enfileira uma execução manual (painel). Se já houver uma do mesmo job aguardando/ativa, devolve a existente
 * (evita acúmulo por cliques repetidos).
 */
export async function enqueueManualJob(name: 'discovery' | 'publish-tick' | 'maintenance' | 'health', requestedBy?: string): Promise<{ jobId: string; alreadyQueued: boolean }> {
  const queue = getQueue(JOB_QUEUE[name]);
  const pending = await queue.getJobs(['active', 'waiting', 'prioritized']);
  const existing = pending.find((j) => j.name === name && (j.data as TickJobData | undefined)?.trigger === 'manual');
  if (existing?.id) return { jobId: existing.id, alreadyQueued: true };
  const data: TickJobData = { trigger: 'manual', ...(requestedBy ? { requestedBy } : {}) };
  const job = await queue.add(name, data, { jobId: `manual-${name}-${randomUUID()}` });
  return { jobId: job.id ?? '', alreadyQueued: false };
}

/** Pede o envio imediato de uma publicação (retry manual). O job é descartável: o estado fica no banco. */
export async function enqueueSendJob(publicationId: string): Promise<void> {
  await getQueue('publish').add(JOB.sendPublication, { publicationId } satisfies SendJobData, {
    jobId: `send-${publicationId}`,
    removeOnComplete: true,
    removeOnFail: true,
  });
}

/** Registra a publicação esgotada na DLQ (um job por publicação). */
export async function addToDeadLetter(data: DeadLetterData): Promise<void> {
  await getQueue('dead-letter').add('publication-dead', data, { jobId: `dead-${data.publicationId}` });
}

// ---------- batimento do worker (para o painel saber se há worker vivo) ----------

export const WORKER_HEARTBEAT_KEY = `${QUEUE_PREFIX}:worker:heartbeat`;
export const WORKER_HEARTBEAT_TTL_S = 120;

export async function writeWorkerHeartbeat(redis: Redis = getQueueConnection()): Promise<void> {
  await redis.set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), 'EX', WORKER_HEARTBEAT_TTL_S);
}

/** Último batimento do worker (null se não houver worker vivo nos últimos ~2 min). */
export async function readWorkerHeartbeat(redis: Redis = getQueueConnection()): Promise<string | null> {
  return redis.get(WORKER_HEARTBEAT_KEY);
}
