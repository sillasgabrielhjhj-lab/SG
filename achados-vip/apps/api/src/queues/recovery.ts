/**
 * Recuperação após reinício/travamento:
 *  - Publication SENDING com lock antigo => FAILED (backoff) ou DEAD, ou volta à fila se o envio nem começou;
 *  - ScheduledJob RUNNING sem heartbeat recente => FAILED + alerta "job_stuck";
 *  - reaplica agendadores e dispara um tick imediato para as pendentes.
 * Todas as operações são idempotentes (condicionais ao estado atual).
 */
import { prisma } from '../lib/db.js';
import { MINUTE_MS, withTimeout } from '../lib/time.js';
import { logEvent } from '../services/logs.js';
import { syncManualChannelStatus } from '../services/channels.js';
import { notify } from '../services/notifications.js';
import { failPublication } from '../services/publishing.js';
import { JOB, getQueue, type TickJobData } from './queues.js';
import { syncSchedules } from './scheduler.js';

/** Envios reais duram segundos; no boot, qualquer lock com mais que isto pertence a um processo morto. */
export const BOOT_STALE_LOCK_MS = 2 * MINUTE_MS;
/** O heartbeat dos jobs bate a cada 15 s; no boot, 1 min sem batimento = processo anterior morreu. */
export const BOOT_STALE_JOB_MS = MINUTE_MS;

const INTERRUPTED = 'Envio interrompido (reinício ou travamento do processo); resultado desconhecido — verifique o canal se houver dúvida';

/** Libera publicações SENDING cujo lock é mais antigo que `olderThanMs`. Devolve quantas foram tratadas. */
export async function releaseStuckPublications(olderThanMs: number, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanMs);
  const stuck = await prisma.publication.findMany({
    where: { status: 'SENDING', OR: [{ lockedAt: { lt: cutoff } }, { lockedAt: null, updatedAt: { lt: cutoff } }] },
    include: { channel: { select: { name: true } }, offer: { select: { product: { select: { title: true } } } } },
  });
  let handled = 0;
  for (const p of stuck) {
    // havia tentativa em andamento? então o provedor pode ter recebido a mensagem
    const open = await prisma.publicationAttempt.updateMany({
      where: { publicationId: p.id, finishedAt: null },
      data: { finishedAt: now, success: false, error: INTERRUPTED },
    });
    if (open.count === 0) {
      // travou antes de chamar o provedor: volta à fila sem consumir tentativa
      const r = await prisma.publication.updateMany({
        where: { id: p.id, status: 'SENDING' },
        data: { status: 'PENDING', lockedAt: null, lastError: 'Envio não chegou a iniciar (processo reiniciado); reagendado' },
      });
      if (r.count === 1) handled++;
    } else if (await failPublication(p, INTERRUPTED, { now })) {
      handled++;
    }
  }
  if (handled > 0) await logEvent('WARN', 'recovery', `${handled} publicação(ões) travada(s) em SENDING foram liberadas`, { olderThanMs });
  return handled;
}

/** Marca como FAILED jobs RUNNING sem heartbeat recente e alerta. Devolve os nomes. */
export async function markStuckJobs(staleMs: number, now = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - staleMs);
  const jobs = await prisma.scheduledJob.findMany({
    where: { status: 'RUNNING', OR: [{ heartbeatAt: { lt: cutoff } }, { heartbeatAt: null, lastRunAt: { lt: cutoff } }] },
  });
  const names: string[] = [];
  for (const j of jobs) {
    const since = j.heartbeatAt ?? j.lastRunAt;
    const minutes = since ? Math.max(1, Math.round((now.getTime() - since.getTime()) / MINUTE_MS)) : null;
    const msg = `Job sem sinal de vida${minutes ? ` há ${minutes} min` : ''}: marcado como falho (processo reiniciado ou travado)`;
    const r = await prisma.scheduledJob.updateMany({
      where: { id: j.id, status: 'RUNNING' },
      data: { status: 'FAILED', lastError: msg, failCount: { increment: 1 }, heartbeatAt: null },
    });
    if (r.count !== 1) continue;
    names.push(j.name);
    await notify({ level: 'ERROR', type: 'job_stuck', title: `Tarefa "${j.name}" travada`, body: msg, dedupeKey: `job-stuck:${j.name}` });
    await logEvent('WARN', 'recovery', `Job "${j.name}" estava RUNNING sem heartbeat`, { job: j.name, since: since?.toISOString() ?? null });
  }
  return names;
}

export interface RecoverySummary {
  releasedPublications: number;
  stuckJobs: string[];
  dueNow: number;
  schedules: string[];
  scheduleError: string | null;
}

/**
 * Executada ao iniciar o worker: libera locks expirados, marca jobs travados, reaplica agendadores e
 * dispara um tick imediato para as publicações pendentes.
 */
export async function recoverOnBoot(now = new Date()): Promise<RecoverySummary> {
  await syncManualChannelStatus();
  const releasedPublications = await releaseStuckPublications(BOOT_STALE_LOCK_MS, now);
  const stuckJobs = await markStuckJobs(BOOT_STALE_JOB_MS, now);
  const dueNow = await prisma.publication.count({
    where: { status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] }, OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
  });

  let schedules: string[] = [];
  let scheduleError: string | null = null;
  try {
    const synced = await withTimeout(syncSchedules(), 10_000, 'syncSchedules');
    schedules = synced.schedules.map((s) => `${s.name}:${s.action}`);
    if (dueNow > 0) {
      await getQueue('publish').add(JOB.publishTick, { trigger: 'boot' } satisfies TickJobData, { jobId: `boot-tick-${now.getTime()}` });
    }
  } catch (err) {
    scheduleError = err instanceof Error ? err.message : String(err);
    await logEvent('ERROR', 'recovery', 'Não foi possível reaplicar os agendadores no boot', { err });
  }
  await logEvent('INFO', 'recovery', 'Recuperação de inicialização concluída', { releasedPublications, stuckJobs, dueNow, schedules });
  return { releasedPublications, stuckJobs, dueNow, schedules, scheduleError };
}
