/**
 * Filas e workers com Redis REAL de teste: agendadores derivados das settings (syncSchedules), manutenção, rastreio de
 * jobs (runTracked), processamento pelos workers de verdade (startWorkers) com adaptador simulado e encerramento limpo.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import {
  JOB_QUEUE,
  QUEUE_NAMES,
  QUEUE_PREFIX,
  closeQueues,
  enqueueManualJob,
  enqueueSendJob,
  getQueue,
  getQueueConnection,
  readWorkerHeartbeat,
  writeWorkerHeartbeat,
  WORKER_HEARTBEAT_KEY,
} from '../../src/queues/queues.js';
import { HEALTH_EVERY_MS, MAINTENANCE_EVERY_MS, PUBLISH_TICK_EVERY_MS, desiredSchedules, notifySettingsChanged, registerSchedules, syncSchedules } from '../../src/queues/scheduler.js';
import { runHealthChecks, runMaintenance, runTracked, startWorkers, type WorkerHandle } from '../../src/queues/workers.js';
import { defaultSettings } from '../../src/domain/settings.js';
import { setOfferSourceProvider } from '../../src/services/policy.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb, resetRedis } from '../helpers/db.js';
import { DAY, HOUR, MIN, TG_TOKEN, ago, leaks, reply, seedChannel, seedManualChannel, seedOffer, seedPublication, seedWebhookChannel, startSim, waitFor, type SimServer } from '../helpers/publishing-fixtures.js';

let sim: SimServer;
let handle: WorkerHandle | null = null;
beforeAll(async () => {
  setSsrfAllowPrivateForTests(true);
  sim = await startSim(async (_h, res) => {
    await new Promise((r) => setTimeout(r, 20));
    reply(res, 200, { id: 'recv' });
  });
});
afterAll(async () => {
  await sim.close();
  setSsrfAllowPrivateForTests(false);
  await closeQueues();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  sim.hits.length = 0;
  setOfferSourceProvider(async () => null); // sem rede: nenhuma revalidação de preço
  await updateSettings({ publishing: { minIntervalMinutes: 0, maxPerHour: 100, maxPerDay: 100, maxPerCategoryPerDay: 100, quietHours: { enabled: false } } });
});
afterEach(async () => {
  setOfferSourceProvider(null);
  vi.restoreAllMocks();
  if (handle) {
    await handle.close();
    handle = null;
  }
});

const reload = (id: string) => prisma.publication.findUniqueOrThrow({ where: { id } });
const sched = (name: string) => getQueue(JOB_QUEUE[name as keyof typeof JOB_QUEUE]).getJobScheduler(name);
const row = (name: string) => prisma.scheduledJob.findUniqueOrThrow({ where: { name } });
const rowIf = (name: string) => prisma.scheduledJob.findUnique({ where: { name } });

describe('filas: nomes, prefixo e batimento do worker', () => {
  it('filas do contrato e prefixo "achados"; cada job aponta para a sua fila', () => {
    expect([...QUEUE_NAMES]).toEqual(['discovery', 'publish', 'maintenance', 'dead-letter']);
    expect(QUEUE_PREFIX).toBe('achados');
    expect(JOB_QUEUE).toEqual({ discovery: 'discovery', 'publish-tick': 'publish', 'send-publication': 'publish', maintenance: 'maintenance', health: 'maintenance' });
  });

  it('batimento do worker é gravado no Redis com expiração e lido pelo painel', async () => {
    expect(await readWorkerHeartbeat()).toBeNull();
    await writeWorkerHeartbeat();
    const beat = await readWorkerHeartbeat();
    expect(Date.now() - Date.parse(beat!)).toBeLessThan(5000);
    const ttl = await getQueueConnection().ttl(WORKER_HEARTBEAT_KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('enqueueManualJob não acumula: clique repetido devolve o job já aguardando; depois de consumido gera outro', async () => {
    const a = await enqueueManualJob('publish-tick', 'u1');
    const b = await enqueueManualJob('publish-tick', 'u2');
    expect(a.alreadyQueued).toBe(false);
    expect(b).toEqual({ jobId: a.jobId, alreadyQueued: true });
    expect(a.jobId).toMatch(/^manual-publish-tick-/);
    const job = await getQueue('publish').getJob(a.jobId);
    expect(job?.data).toEqual({ trigger: 'manual', requestedBy: 'u1' });
    await job!.remove();
    expect((await enqueueManualJob('publish-tick')).alreadyQueued).toBe(false);
    // jobs diferentes não se confundem
    expect((await enqueueManualJob('discovery')).alreadyQueued).toBe(false);
  });
});

describe('syncSchedules: agendadores conforme as settings', () => {
  it('desiredSchedules: descoberta só com monitoring.enabled (intervalo em minutos); os demais são fixos', () => {
    const off = defaultSettings();
    expect(desiredSchedules(off)).toEqual([
      { name: 'discovery', everyMs: null },
      { name: 'publish-tick', everyMs: 60_000 },
      { name: 'maintenance', everyMs: 300_000 },
      { name: 'health', everyMs: 300_000 },
    ]);
    const on = defaultSettings();
    on.monitoring.enabled = true;
    on.monitoring.intervalMinutes = 7;
    expect(desiredSchedules(on)[0]).toEqual({ name: 'discovery', everyMs: 7 * 60_000 });
    expect([PUBLISH_TICK_EVERY_MS, MAINTENANCE_EVERY_MS, HEALTH_EVERY_MS]).toEqual([60_000, 300_000, 300_000]);
  });

  it('padrão (monitoramento desligado): cria publish-tick/maintenance/health e NÃO cria discovery; ScheduledJob espelha', async () => {
    const { schedules } = await syncSchedules();
    expect(schedules.map((s) => [s.name, s.action, s.everyMs])).toEqual([
      ['discovery', 'absent', null],
      ['publish-tick', 'created', 60_000],
      ['maintenance', 'created', 300_000],
      ['health', 'created', 300_000],
    ]);
    expect(await sched('discovery')).toBeFalsy();
    expect(await sched('publish-tick')).toMatchObject({ name: 'publish-tick', every: 60_000 });
    expect(await sched('maintenance')).toMatchObject({ every: 300_000 });
    expect(await sched('health')).toMatchObject({ every: 300_000 });
    expect(await row('discovery')).toMatchObject({ queue: 'discovery', everyMs: null, enabled: false, nextRunAt: null });
    expect(await row('publish-tick')).toMatchObject({ queue: 'publish', everyMs: 60_000, enabled: true });
    expect((await row('publish-tick')).nextRunAt).toBeInstanceOf(Date);
    // o job gerado pelo agendador leva o gatilho "schedule" e as opções de retentativa da fila
    const jobs = await getQueue('publish').getJobs(['delayed', 'waiting']);
    const tick = jobs.find((j) => j.name === 'publish-tick');
    expect(tick?.data).toEqual({ trigger: 'schedule' });
    expect(tick?.opts.attempts).toBe(1);
    const disc = await getQueue('maintenance').getJobs(['delayed', 'waiting']);
    expect(disc.find((j) => j.name === 'maintenance')?.opts.attempts).toBe(2);
  });

  it('monitoring.enabled=true cria o discovery com o intervalo; repetir é "unchanged"; mudar o intervalo é "updated"; desligar REMOVE', async () => {
    await updateSettings({ monitoring: { enabled: true, intervalMinutes: 15 } });
    let r = await syncSchedules();
    expect(r.schedules[0]).toMatchObject({ name: 'discovery', action: 'created', everyMs: 15 * MIN });
    expect(await sched('discovery')).toMatchObject({ every: 15 * MIN });
    expect(await row('discovery')).toMatchObject({ everyMs: 15 * MIN, enabled: true });

    r = await syncSchedules();
    expect(r.schedules.map((s) => s.action)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged']);

    await updateSettings({ monitoring: { intervalMinutes: 20 } });
    r = await syncSchedules();
    expect(r.schedules.map((s) => s.action)).toEqual(['updated', 'unchanged', 'unchanged', 'unchanged']);
    expect(await sched('discovery')).toMatchObject({ every: 20 * MIN });
    expect(await row('discovery')).toMatchObject({ everyMs: 20 * MIN });

    await updateSettings({ monitoring: { enabled: false } });
    r = await syncSchedules();
    expect(r.schedules[0]).toMatchObject({ name: 'discovery', action: 'removed', everyMs: null, nextRunAt: null });
    expect(await sched('discovery')).toBeFalsy();
    expect(await row('discovery')).toMatchObject({ everyMs: null, enabled: false, nextRunAt: null });
    expect(await getQueue('discovery').getJobs(['delayed'])).toHaveLength(0); // nenhuma execução FUTURA sobra
    expect((await getQueue('discovery').getJobSchedulers()).map((x) => x.name)).not.toContain('discovery');

    r = await syncSchedules();
    expect(r.schedules[0]).toMatchObject({ action: 'absent' });
  });

  it('Redis zerado (ou outro processo apagou os agendadores) => o sync recria tudo', async () => {
    await updateSettings({ monitoring: { enabled: true, intervalMinutes: 10 } });
    await syncSchedules();
    await resetRedis();
    const { schedules } = await syncSchedules();
    expect(schedules.map((s) => s.action)).toEqual(['created', 'created', 'created', 'created']);
    expect(await sched('discovery')).toMatchObject({ every: 10 * MIN });
  });

  it('registerSchedules (nome do contrato) aplica as settings; notifySettingsChanged reaplica sem bloquear', async () => {
    await registerSchedules();
    expect(await sched('publish-tick')).toBeTruthy();
    await updateSettings({ monitoring: { enabled: true, intervalMinutes: 30 } });
    notifySettingsChanged();
    const found = await waitFor(async () => sched('discovery'));
    expect(found.every).toBe(30 * MIN);
  });
});

describe('runTracked: rastreio de ScheduledJob', () => {
  it('sucesso: RUNNING com heartbeat durante a execução, depois SUCCEEDED com duração, contagem e estatísticas mescladas', async () => {
    let during: Awaited<ReturnType<typeof row>> | null = null;
    const out = await runTracked('maintenance', 'maintenance', async () => {
      during = await row('maintenance');
      return { a: 1 };
    });
    expect(out).toEqual({ a: 1 });
    expect(during!.status).toBe('RUNNING');
    expect(during!.heartbeatAt).toBeInstanceOf(Date);
    const first = await row('maintenance');
    expect(first).toMatchObject({ status: 'SUCCEEDED', runCount: 1, failCount: 0, lastError: null, heartbeatAt: null, lastStats: { a: 1 } });
    expect(first.lastSuccessAt).toBeInstanceOf(Date);
    expect(first.lastDurationMs).toBeGreaterThanOrEqual(0);
    await runTracked('maintenance', 'maintenance', async () => ({ b: 2 }));
    expect(await row('maintenance')).toMatchObject({ runCount: 2, lastStats: { a: 1, b: 2 } }); // chaves antigas preservadas
  });

  it('falha: FAILED com erro SANITIZADO, failCount+1, heartbeat limpo e a exceção segue para o BullMQ', async () => {
    await expect(
      runTracked('health', 'maintenance', async () => {
        throw new Error(`falhou com Bearer EAAGm0PX4ZCpsBAKtestTOKENabcdefghijklmnop12345 e bot${TG_TOKEN}`);
      }),
    ).rejects.toThrow(/falhou/);
    const r = await row('health');
    expect(r).toMatchObject({ status: 'FAILED', runCount: 1, failCount: 1, heartbeatAt: null });
    expect(r.lastError).toContain('[REDACTED]');
    expect(leaks(r.lastError)).toEqual([]);
  });

  it('próxima execução é projetada a partir do intervalo do agendador', async () => {
    await syncSchedules();
    await runTracked('publish-tick', 'publish', async () => ({}));
    const r = await row('publish-tick');
    expect(r.nextRunAt!.getTime() - r.lastSuccessAt!.getTime()).toBe(60_000);
  });
});

describe('runMaintenance (sim)', () => {
  it('trata jobs/publicações travados, expira a fila manual e sessões vencidas, corrige o status da fila manual e aplica retenção', async () => {
    const now = new Date();
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    // job travado há 20 min (limite 15) e outro saudável
    await prisma.scheduledJob.create({ data: { name: 'discovery', queue: 'discovery', status: 'RUNNING', lastRunAt: ago(30 * MIN, now), heartbeatAt: ago(20 * MIN, now) } });
    await prisma.scheduledJob.create({ data: { name: 'health', queue: 'maintenance', status: 'RUNNING', lastRunAt: ago(30 * MIN, now), heartbeatAt: ago(5 * MIN, now) } });
    // publicação presa há 11 min (limite 10) e outra recente
    const stuck = await seedOffer();
    const stuckPub = await seedPublication(stuck.offer, ch, stuck.link, { status: 'SENDING', lockedAt: ago(11 * MIN, now) });
    const fresh = await seedOffer();
    const freshPub = await seedPublication(fresh.offer, ch, fresh.link, { status: 'SENDING', lockedAt: ago(9 * MIN, now) });
    // fila manual: item de 25h expira, canal manual com status desatualizado
    const manual = await seedManualChannel({ status: 'UNKNOWN' });
    const old = await seedOffer();
    const oldPub = await seedPublication(old.offer, manual, old.link, { status: 'MANUAL_READY', createdAt: ago(25 * HOUR, now) });
    // retenção
    await prisma.systemLog.create({ data: { level: 'INFO', scope: 'x', message: 'velho', createdAt: ago(40 * DAY, now) } });
    await prisma.systemLog.create({ data: { level: 'INFO', scope: 'x', message: 'recente', createdAt: ago(DAY, now) } });
    const s = await seedOffer();
    await prisma.priceHistory.create({ data: { productId: s.product.id, listingId: 'MLB1', source: 'test', priceCents: 100, observedAt: ago(400 * DAY, now) } });
    await prisma.priceHistory.create({ data: { productId: s.product.id, listingId: 'MLB1', source: 'test', priceCents: 100, observedAt: ago(10 * DAY, now) } });
    // sessões
    const user = await prisma.user.create({ data: { email: 'u@teste.local', passwordHash: 'x' } });
    await prisma.session.create({ data: { userId: user.id, tokenHash: 'h1', csrfToken: 'c', expiresAt: ago(MIN, now) } });
    await prisma.session.create({ data: { userId: user.id, tokenHash: 'h2', csrfToken: 'c', expiresAt: new Date(now.getTime() + HOUR) } });

    const r = await runMaintenance(now);
    expect(r).toMatchObject({ stuckJobs: 1, releasedPublications: 1, expiredManualQueue: 1, expiredSessions: 1 });
    expect(r.purged).toEqual({ logs: expect.any(Number), priceHistory: 1 });
    expect(r.purged!.logs).toBeGreaterThanOrEqual(1);
    expect(r.lastPurgeAt).toBe(now.toISOString());

    expect((await row('discovery')).status).toBe('FAILED');
    expect((await row('health')).status).toBe('RUNNING');
    expect((await reload(stuckPub.id)).status).toBe('PENDING');
    expect((await reload(freshPub.id)).status).toBe('SENDING');
    expect(await reload(oldPub.id)).toMatchObject({ status: 'CANCELLED' });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: manual.id } })).status).toBe('CONNECTED');
    expect(await prisma.systemLog.count({ where: { message: 'velho' } })).toBe(0);
    expect(await prisma.systemLog.count({ where: { message: 'recente' } })).toBe(1);
    expect(await prisma.priceHistory.count()).toBe(1);
    expect(await prisma.session.count()).toBe(1);
  });

  it('a retenção roda no máximo 1x por hora (a segunda execução não apaga de novo e preserva lastPurgeAt)', async () => {
    const now = new Date();
    const first = await runTracked('maintenance', 'maintenance', () => runMaintenance(now));
    expect(first.purged).not.toBeNull();
    const second = await runTracked('maintenance', 'maintenance', () => runMaintenance(new Date(now.getTime() + 10 * MIN)));
    expect(second.purged).toBeNull();
    expect(second.lastPurgeAt).toBe(now.toISOString());
    const third = await runTracked('maintenance', 'maintenance', () => runMaintenance(new Date(now.getTime() + 61 * MIN)));
    expect(third.purged).not.toBeNull();
  });
});

describe('runHealthChecks (sim)', () => {
  it('testa canais automáticos habilitados (webhook simulado OK => CONNECTED) e ignora fila manual e canais desabilitados', async () => {
    const ok = await seedWebhookChannel(`${sim.url}/hook`, { status: 'UNKNOWN' });
    await seedManualChannel();
    await seedWebhookChannel(`${sim.url}/off`, { enabled: false, status: 'UNKNOWN' });
    const r = await runHealthChecks();
    expect(r).toMatchObject({ channels: 1, connected: 1, problems: 0, source: null });
    expect(await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ok.id } })).toMatchObject({ status: 'CONNECTED' });
  });

  it('canal com problema => ERROR + notificação integration_error; ao voltar a funcionar o alerta é resolvido', async () => {
    const dead = await startSim((_h, res) => reply(res, 200));
    const url = `${dead.url}/hook`;
    await dead.close();
    const ch = await seedWebhookChannel(url, { status: 'CONNECTED' });
    expect(await runHealthChecks()).toMatchObject({ channels: 1, connected: 0, problems: 1 });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('ERROR');
    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `channel-error:${ch.id}` } });
    expect(note.readAt).toBeNull();

    await prisma.publishingChannel.update({ where: { id: ch.id }, data: { config: { url: `${sim.url}/hook` } } });
    expect(await runHealthChecks()).toMatchObject({ connected: 1, problems: 0 });
    expect((await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `channel-error:${ch.id}` } })).readAt).not.toBeNull();
  });
});

describe('workers reais (sim): startWorkers com Redis e webhook simulado', () => {
  async function pendingPub() {
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    return { ch, ...s, pub };
  }

  it('startWorkers sobe 3 workers (discovery, publish, maintenance), concorrência 1, no prefixo achados', () => {
    handle = startWorkers();
    expect(handle.workers.map((w) => w.name).sort()).toEqual(['discovery', 'maintenance', 'publish']);
    for (const w of handle.workers) {
      expect(w.isRunning()).toBe(true);
      expect(w.opts.concurrency).toBe(1);
      expect(w.opts.prefix).toBe('achados');
    }
  });

  it('job publish-tick manual (rota "executar publicador") é processado pelo worker: envia ao simulador e rastreia o ScheduledJob', async () => {
    const { pub } = await pendingPub();
    handle = startWorkers();
    const { jobId } = await enqueueManualJob('publish-tick', 'tester');
    await waitFor(async () => (await reload(pub.id)).status === 'SENT');
    expect(sim.hits).toHaveLength(1);
    const sj = await waitFor(async () => {
      const r = await rowIf('publish-tick');
      return r?.status === 'SUCCEEDED' ? r : null;
    });
    expect(sj).toMatchObject({ runCount: 1, lastError: null, lastStats: { sent: 1, failed: 0 } });
    const job = await waitFor(async () => {
      const j = await getQueue('publish').getJob(jobId);
      return j && (await j.isCompleted()) ? j : null;
    });
    expect(job.returnvalue).toMatchObject({ sent: 1 });
  });

  it('job gerado pelo AGENDADOR (trigger "schedule") também é processado, e o próximo ciclo continua agendado', async () => {
    const { pub } = await pendingPub();
    await syncSchedules(); // a primeira execução do agendador entra na fila na hora
    const queued = (await getQueue('publish').getJobs(['delayed', 'waiting'])).find((j) => j.name === 'publish-tick');
    expect(queued?.data).toEqual({ trigger: 'schedule' });
    handle = startWorkers();
    if (queued && (await queued.isDelayed())) await queued.promote();
    await waitFor(async () => (await reload(pub.id)).status === 'SENT');
    expect(sim.hits.filter((h) => h.method === 'POST')).toHaveLength(1); // (o job "health" agendado faz HEAD)
    await waitFor(async () => (await rowIf('publish-tick'))?.status === 'SUCCEEDED');
    expect(await sched('publish-tick')).toMatchObject({ every: 60_000 });
    await waitFor(async () => (await getQueue('publish').getJobs(['delayed'])).some((j) => j.name === 'publish-tick'));
  });

  it('job send-publication (retry do painel) envia só aquela publicação; trava dura vira { held } sem falhar o job', async () => {
    const a = await pendingPub();
    const b = await pendingPub();
    await prisma.affiliateLink.update({ where: { id: b.link!.id }, data: { status: 'INVALID' } });
    handle = startWorkers();
    await enqueueSendJob(a.pub.id);
    await enqueueSendJob(b.pub.id);
    await waitFor(async () => (await reload(a.pub.id)).status === 'SENT');
    await waitFor(async () => (await reload(b.pub.id)).scheduledFor !== null); // ficou aguardando (hold)
    expect(sim.hits).toHaveLength(1);
    expect((await reload(b.pub.id)).status).toBe('PENDING');
    const counts = await getQueue('publish').getJobCounts('failed', 'active', 'waiting');
    expect(counts).toEqual({ failed: 0, active: 0, waiting: 0 });
  });

  it('o worker não duplica: o mesmo job de envio enfileirado duas vezes gera 1 só envio', async () => {
    const { pub } = await pendingPub();
    handle = startWorkers();
    await enqueueSendJob(pub.id);
    await enqueueSendJob(pub.id);
    await enqueueManualJob('publish-tick');
    await waitFor(async () => (await reload(pub.id)).status === 'SENT');
    await new Promise((r) => setTimeout(r, 500));
    expect(sim.hits).toHaveLength(1);
  });

  it('descoberta agendada com monitoramento desligado é ignorada (skipped) pelo worker', async () => {
    handle = startWorkers();
    const job = await getQueue('discovery').add('discovery', { trigger: 'schedule' }, { jobId: 'sched-1', attempts: 1 });
    const done = await waitFor(async () => {
      const j = await getQueue('discovery').getJob(job.id!);
      return j && (await j.isCompleted()) ? j : null;
    });
    expect(done.returnvalue).toEqual({ skipped: 'monitoramento desabilitado' });
  });

  it('falha final de um job => ScheduledJob FAILED, SystemLog ERROR e notificação job_failed (deduplicada), sem segredos', async () => {
    handle = startWorkers();
    vi.spyOn(prisma.scheduledJob, 'findMany').mockRejectedValue(new Error(`banco indisponível Bearer EAAGm0PX4ZCpsBAKtestTOKENabcdefghijklmnop12345`));
    for (const id of ['f1', 'f2']) await getQueue('maintenance').add('maintenance', { trigger: 'manual' }, { jobId: id, attempts: 1 });
    await waitFor(async () => (await prisma.notification.count({ where: { type: 'job_failed' } })) > 0);
    await waitFor(async () => (await rowIf('maintenance'))?.status === 'FAILED');
    await waitFor(async () => (await getQueue('maintenance').getJobCounts('failed')).failed === 2);
    expect(await prisma.notification.count({ where: { type: 'job_failed' } })).toBe(1);
    const note = await prisma.notification.findFirstOrThrow({ where: { type: 'job_failed' } });
    expect(note).toMatchObject({ level: 'ERROR', dedupeKey: 'job-failed:maintenance' });
    expect(note.body).toContain('[REDACTED]');
    expect((await row('maintenance')).lastError).toMatch(/banco indisponível/);
    expect(await prisma.systemLog.count({ where: { scope: 'queues', level: 'ERROR' } })).toBeGreaterThanOrEqual(1);
  });

  it('close(): encerra os workers e as conexões; jobs novos NÃO são processados depois', async () => {
    const { pub } = await pendingPub();
    handle = startWorkers();
    const h = handle;
    await h.close();
    handle = null;
    expect(h.workers.every((w) => !w.isRunning())).toBe(true);
    await enqueueSendJob(pub.id);
    await new Promise((r) => setTimeout(r, 600));
    expect((await reload(pub.id)).status).toBe('PENDING');
    expect(sim.hits).toHaveLength(0);
    expect(await getQueue('publish').getJobCounts('waiting')).toEqual({ waiting: 1 });
    await h.close(); // idempotente
  });

  it('close() espera o envio em andamento terminar (nada fica preso em SENDING)', async () => {
    const slow = await startSim(async (_h, res) => {
      await new Promise((r) => setTimeout(r, 700));
      reply(res, 200, { id: 'lento' });
    });
    try {
      const ch = await seedWebhookChannel(`${slow.url}/hook`);
      const s = await seedOffer();
      const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
      handle = startWorkers();
      await enqueueSendJob(pub.id);
      await waitFor(async () => slow.hits.length === 1); // envio em andamento
      expect((await reload(pub.id)).status).toBe('SENDING');
      const h = handle;
      handle = null;
      await h.close();
      expect(await reload(pub.id)).toMatchObject({ status: 'SENT', externalMessageId: 'lento', lockedAt: null });
    } finally {
      await slow.close();
    }
  });
});

describe('manutenção e saúde pelo worker (sim)', () => {
  it('jobs maintenance e health são processados e rastreados', async () => {
    await seedChannel('WEBHOOK', { config: { url: `${sim.url}/hook` }, credentialId: (await seedWebhookChannel(`${sim.url}/x`, { enabled: false })).credentialId, status: 'UNKNOWN' });
    handle = startWorkers();
    await getQueue('maintenance').add('maintenance', { trigger: 'manual' }, { jobId: 'm1', attempts: 1 });
    await getQueue('maintenance').add('health', { trigger: 'manual' }, { jobId: 'h1', attempts: 1 });
    await waitFor(async () => (await rowIf('maintenance'))?.status === 'SUCCEEDED');
    const h = await waitFor(async () => {
      const r = await rowIf('health');
      return r?.status === 'SUCCEEDED' ? r : null;
    });
    expect(h.lastStats).toMatchObject({ channels: 1, connected: 1 });
    expect((await row('maintenance')).lastStats).toMatchObject({ stuckJobs: 0, releasedPublications: 0, expiredManualQueue: 0 });
  });
});
