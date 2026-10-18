/**
 * Recuperação após reinício/travamento (simulado): locks SENDING vencidos, jobs RUNNING sem heartbeat e a garantia de
 * que nada é enviado duas vezes. Banco e Redis reais; o "provedor" é um webhook simulado em localhost.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { BOOT_STALE_JOB_MS, BOOT_STALE_LOCK_MS, markStuckJobs, recoverOnBoot, releaseStuckPublications } from '../../src/queues/recovery.js';
import { closeQueues, getQueue } from '../../src/queues/queues.js';
import { processDue, sendPublication } from '../../src/services/publishing.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb, resetRedis } from '../helpers/db.js';
import { MIN, ago, failure, reply, scriptedAdapter, seedManualChannel, seedOffer, seedPublication, seedWebhookChannel, startSim, waitFor, type SimServer } from '../helpers/publishing-fixtures.js';

let sim: SimServer;
beforeAll(async () => {
  setSsrfAllowPrivateForTests(true);
  sim = await startSim((_h, res) => reply(res, 200, { id: 'recv' }));
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
  await updateSettings({ publishing: { minIntervalMinutes: 0, maxPerHour: 100, maxPerDay: 100, maxPerCategoryPerDay: 100, quietHours: { enabled: false } } });
});

const reload = (id: string) => prisma.publication.findUniqueOrThrow({ where: { id } });
const attemptsOf = (id: string) => prisma.publicationAttempt.findMany({ where: { publicationId: id }, orderBy: { startedAt: 'asc' } });
const hookChannel = () => seedWebhookChannel(`${sim.url}/hook`);

/** Publicação SENDING como se o processo tivesse morrido: `withAttempt` = a chamada ao provedor já tinha começado. */
async function crashedSending(opts: { lockedAgoMs: number; withAttempt: boolean; attemptsCount?: number }) {
  const ch = await hookChannel();
  const s = await seedOffer();
  const pub = await seedPublication(s.offer, ch, s.link, { status: 'SENDING', lockedAt: ago(opts.lockedAgoMs, new Date()), attemptsCount: opts.attemptsCount ?? 0 });
  if (opts.withAttempt) await prisma.publicationAttempt.create({ data: { publicationId: pub.id, startedAt: ago(opts.lockedAgoMs, new Date()) } });
  return { ch, ...s, pub };
}

describe('releaseStuckPublications (sim): lock SENDING vencido volta a ser enviável', () => {
  it('travou ANTES de chamar o provedor (sem tentativa aberta) => volta a PENDING sem consumir tentativa e é enviada UMA vez', async () => {
    const { pub } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: false });
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(1);
    const back = await reload(pub.id);
    expect(back).toMatchObject({ status: 'PENDING', lockedAt: null, attemptsCount: 0 });
    expect(back.lastError).toMatch(/não chegou a iniciar/);

    const stats = await processDue(new Date(), { source: null });
    expect(stats).toMatchObject({ sent: 1 });
    expect(sim.hits).toHaveLength(1);
    expect((await reload(pub.id)).status).toBe('SENT');
    // um segundo "reinício" não reenvia nada
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(0);
    await processDue(new Date(), { source: null });
    expect(sim.hits).toHaveLength(1);
  });

  it('travou DEPOIS de iniciar o envio (tentativa aberta) => tentativa encerrada como interrompida, FAILED com backoff; NÃO reenvia no mesmo instante', async () => {
    const { pub } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: true });
    const now = new Date();
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS, now)).toBe(1);
    const back = await reload(pub.id);
    expect(back).toMatchObject({ status: 'FAILED', lockedAt: null, attemptsCount: 1 });
    expect(back.lastError).toMatch(/interrompido/);
    expect(back.scheduledFor!.getTime()).toBe(now.getTime() + MIN);
    const [att] = await attemptsOf(pub.id);
    expect(att).toMatchObject({ success: false });
    expect(att!.finishedAt).toBeInstanceOf(Date);
    expect(att!.error).toMatch(/Envio interrompido/);

    // o provedor pode ter recebido a mensagem: nada sai antes do backoff
    expect(await processDue(now, { source: null })).toMatchObject({ sent: 0 });
    expect(sim.hits).toHaveLength(0);
    // depois do backoff a retentativa sai (risco residual documentado: pelo-menos-uma-vez)
    expect(await processDue(new Date(now.getTime() + 2 * MIN), { source: null })).toMatchObject({ sent: 1 });
    expect(sim.hits).toHaveLength(1);
  });

  it('com as tentativas esgotadas a interrupção vira DEAD (+ notificação e fila dead-letter)', async () => {
    await updateSettings({ publishing: { maxAttempts: 2 } });
    const { pub } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: true, attemptsCount: 1 });
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(1);
    expect(await reload(pub.id)).toMatchObject({ status: 'DEAD', attemptsCount: 2, scheduledFor: null });
    expect(await prisma.notification.count({ where: { dedupeKey: `pub-dead:${pub.id}` } })).toBe(1);
    expect(await getQueue('dead-letter').getJob(`dead-${pub.id}`)).toBeTruthy();
    expect(await processDue(new Date(Date.now() + 24 * 60 * MIN), { source: null })).toMatchObject({ sent: 0 });
    expect(sim.hits).toHaveLength(0);
  });

  it('lock recente (30 s) não é tocado; a fronteira é o limite informado', async () => {
    const { pub } = await crashedSending({ lockedAgoMs: 30_000, withAttempt: true });
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(0);
    expect((await reload(pub.id)).status).toBe('SENDING');
    expect(await releaseStuckPublications(10_000)).toBe(1); // com tolerância menor, 30 s já é "velho"
  });

  it('SENDING sem lockedAt é liberado pelo updatedAt antigo', async () => {
    const ch = await hookChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'SENDING' });
    await prisma.$executeRaw`UPDATE "Publication" SET "updatedAt" = ${ago(30 * MIN, new Date())} WHERE id = ${pub.id}`;
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(1);
    expect((await reload(pub.id)).status).toBe('PENDING');
  });

  it('só SENDING é tratado: SENT, FAILED, PENDING, MANUAL_READY e DEAD ficam como estão', async () => {
    const ch = await hookChannel();
    const manual = await seedManualChannel();
    const before: Record<string, string> = {};
    for (const status of ['SENT', 'FAILED', 'PENDING', 'MANUAL_READY', 'DEAD', 'CANCELLED'] as const) {
      const s = await seedOffer();
      const pub = await seedPublication(s.offer, status === 'MANUAL_READY' ? manual : ch, s.link, { status, lockedAt: ago(60 * MIN, new Date()), ...(status === 'SENT' ? { sentAt: ago(MIN, new Date()) } : {}) });
      before[pub.id] = status;
    }
    expect(await releaseStuckPublications(BOOT_STALE_LOCK_MS)).toBe(0);
    for (const [id, status] of Object.entries(before)) expect((await reload(id)).status).toBe(status);
  });

  it('é idempotente: uma segunda passada não conta tentativa de novo', async () => {
    const { pub } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: true });
    await releaseStuckPublications(BOOT_STALE_LOCK_MS);
    await releaseStuckPublications(BOOT_STALE_LOCK_MS);
    expect((await reload(pub.id)).attemptsCount).toBe(1);
    expect(await attemptsOf(pub.id)).toHaveLength(1);
  });
});

describe('processo "zumbi" (sim): envio em andamento na hora da recuperação', () => {
  it('o tick nunca reenvia uma publicação SENDING; recuperada, a conclusão tardia não sobrescreve o estado nem duplica tentativas', async () => {
    const ch = await seedManualChannel(); // canal só para a FK; o adaptador é injetado
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const adapter = scriptedAdapter([async () => {
      await gate;
      return failure({ error: 'resposta tardia do provedor' });
    }]);
    const deps = { source: null, createAdapter: () => adapter } as const;

    const inflight = sendPublication(pub.id, { ...deps, now: new Date() });
    await waitFor(async () => (await attemptsOf(pub.id)).length === 1 && (await reload(pub.id)).status === 'SENDING');

    // o tick e outra chamada não enxergam a publicação (SENDING) => ninguém duplica o envio
    await processDue(new Date(), deps);
    await sendPublication(pub.id, { ...deps, now: new Date() });
    expect(adapter.calls).toHaveLength(1);

    // "reinício": a recuperação trata o lock como órfão
    expect(await releaseStuckPublications(0, new Date(Date.now() + 1000))).toBe(1);
    expect(await reload(pub.id)).toMatchObject({ status: 'FAILED', attemptsCount: 1 });

    release();
    await inflight;
    const final = await reload(pub.id);
    expect(final).toMatchObject({ status: 'FAILED', attemptsCount: 1 }); // a falha tardia não contou duas vezes
    expect(adapter.calls).toHaveLength(1);
    expect(await attemptsOf(pub.id)).toHaveLength(1);
  });
});

describe('markStuckJobs (sim): jobs RUNNING sem heartbeat', () => {
  const job = (name: string, over: Record<string, unknown> = {}) =>
    prisma.scheduledJob.create({ data: { name, queue: 'publish', status: 'RUNNING', lastRunAt: ago(30 * MIN, new Date()), heartbeatAt: ago(10 * MIN, new Date()), ...over } });

  it('heartbeat antigo => FAILED + failCount + notificação job_stuck (deduplicada) + log; heartbeat recente intacto', async () => {
    await job('publish-tick');
    await job('discovery', { heartbeatAt: ago(10_000, new Date()) });
    const names = await markStuckJobs(BOOT_STALE_JOB_MS);
    expect(names).toEqual(['publish-tick']);
    const stuck = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'publish-tick' } });
    expect(stuck).toMatchObject({ status: 'FAILED', failCount: 1, heartbeatAt: null });
    expect(stuck.lastError).toMatch(/sem sinal de vida há 10 min/);
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).status).toBe('RUNNING');

    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: 'job-stuck:publish-tick' } });
    expect(note).toMatchObject({ type: 'job_stuck', level: 'ERROR', readAt: null });
    expect(note.title).toMatch(/publish-tick/);
    expect(await prisma.systemLog.count({ where: { scope: 'recovery', level: 'WARN' } })).toBeGreaterThanOrEqual(1);

    // idempotente: já está FAILED
    expect(await markStuckJobs(BOOT_STALE_JOB_MS)).toEqual([]);
    expect(await prisma.notification.count({ where: { type: 'job_stuck' } })).toBe(1);
  });

  it('sem heartbeat mas com lastRunAt antigo também é marcado; IDLE/SUCCEEDED/FAILED nunca são tocados', async () => {
    await job('maintenance', { heartbeatAt: null });
    for (const status of ['IDLE', 'SUCCEEDED', 'FAILED'] as const) await job(`outro-${status}`, { status, heartbeatAt: ago(60 * MIN, new Date()) });
    expect(await markStuckJobs(BOOT_STALE_JOB_MS)).toEqual(['maintenance']);
    for (const status of ['IDLE', 'SUCCEEDED', 'FAILED'] as const) expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: `outro-${status}` } })).status).toBe(status);
  });

  it('a notificação já lida reabre quando o mesmo job trava de novo', async () => {
    await job('publish-tick');
    await markStuckJobs(BOOT_STALE_JOB_MS);
    await prisma.notification.updateMany({ data: { readAt: new Date() } });
    await prisma.scheduledJob.update({ where: { name: 'publish-tick' }, data: { status: 'RUNNING', heartbeatAt: ago(10 * MIN, new Date()) } });
    await markStuckJobs(BOOT_STALE_JOB_MS);
    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: 'job-stuck:publish-tick' } });
    expect(note.readAt).toBeNull();
    expect(await prisma.notification.count()).toBe(1);
  });
});

describe('recoverOnBoot (sim): reinício completo do worker', () => {
  it('libera locks, marca jobs travados, reaplica agendadores, dispara tick de boot e não duplica envio', async () => {
    const { pub: orphan } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: false });
    const { pub: inDoubt } = await crashedSending({ lockedAgoMs: 10 * MIN, withAttempt: true });
    const ch = await hookChannel();
    const done = await seedOffer();
    const sent = await seedPublication(done.offer, ch, done.link, { status: 'SENT', sentAt: ago(60 * MIN, new Date()), externalMessageId: 'ja-enviada' });
    const manual = await seedManualChannel();
    await prisma.publishingChannel.update({ where: { id: manual.id }, data: { status: 'UNKNOWN' } });
    await prisma.scheduledJob.create({ data: { name: 'publish-tick', queue: 'publish', status: 'RUNNING', lastRunAt: ago(30 * MIN, new Date()), heartbeatAt: ago(10 * MIN, new Date()) } });
    await prisma.scheduledJob.create({ data: { name: 'discovery', queue: 'discovery', status: 'RUNNING', lastRunAt: ago(5_000, new Date()), heartbeatAt: ago(5_000, new Date()) } });

    const now = new Date();
    const summary = await recoverOnBoot(now);
    expect(summary).toMatchObject({ releasedPublications: 2, stuckJobs: ['publish-tick'], scheduleError: null });
    expect(summary.dueNow).toBeGreaterThanOrEqual(1);
    expect(summary.schedules).toEqual(expect.arrayContaining(['publish-tick:created', 'maintenance:created', 'health:created', 'discovery:absent']));

    expect(await reload(orphan.id)).toMatchObject({ status: 'PENDING', lockedAt: null });
    expect(await reload(inDoubt.id)).toMatchObject({ status: 'FAILED', lockedAt: null, attemptsCount: 1 });
    expect(await reload(sent.id)).toMatchObject({ status: 'SENT', externalMessageId: 'ja-enviada' });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: manual.id } })).status).toBe('CONNECTED');
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'publish-tick' } })).status).toBe('FAILED');
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).status).toBe('RUNNING'); // heartbeat fresco
    expect(await prisma.notification.count({ where: { type: 'job_stuck' } })).toBe(1);

    // agendadores no Redis + tick de boot enfileirado para as pendentes
    const publish = getQueue('publish');
    expect(await publish.getJobScheduler('publish-tick')).toMatchObject({ every: 60_000 });
    const boot = await publish.getJob(`boot-tick-${now.getTime()}`);
    expect(boot?.name).toBe('publish-tick');
    expect(boot?.data).toEqual({ trigger: 'boot' });

    // o tick que o boot dispara envia a órfã uma vez; a "em dúvida" espera o backoff; a SENT não é tocada
    expect(await processDue(new Date(), { source: null })).toMatchObject({ sent: 1 });
    expect(sim.hits).toHaveLength(1);
    expect(sim.hits[0]!.json().idempotencyKey).toBe(orphan.idempotencyKey);

    // um novo reinício logo depois não muda nada nem reenvia
    const again = await recoverOnBoot(new Date());
    expect(again).toMatchObject({ releasedPublications: 0, stuckJobs: [], scheduleError: null });
    expect(again.schedules).toEqual(expect.arrayContaining(['publish-tick:unchanged']));
    await processDue(new Date(), { source: null });
    expect(sim.hits).toHaveLength(1);
    expect(await reload(sent.id)).toMatchObject({ status: 'SENT', attemptsCount: 0 });
  });

  it('sem pendentes não enfileira tick de boot', async () => {
    const now = new Date();
    const summary = await recoverOnBoot(now);
    expect(summary).toMatchObject({ releasedPublications: 0, stuckJobs: [], dueNow: 0, scheduleError: null });
    expect(await getQueue('publish').getJob(`boot-tick-${now.getTime()}`)).toBeFalsy();
  });
});
