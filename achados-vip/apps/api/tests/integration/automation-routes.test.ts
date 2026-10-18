/**
 * Rotas /api/automation/run-discovery, /run-publisher e /apply: exigem login + CSRF, só ADMIN, auditam, não acumulam
 * jobs e (com Redis real) realmente enfileiram o job manual. O consumo pelo worker é coberto em queues-workers.test.ts.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { closeQueues, getQueue } from '../../src/queues/queues.js';
import { updateSettings } from '../../src/services/settings.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb, resetRedis } from '../helpers/db.js';

let app: FastifyInstance;
let agent: TestAgent;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
  await closeQueues();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  await createTestAdmin();
  agent = await loginAgent(app);
});

const RUNS = [
  { url: '/api/automation/run-discovery', queue: 'discovery', job: 'discovery', action: 'automation.run-discovery' },
  { url: '/api/automation/run-publisher', queue: 'publish', job: 'publish-tick', action: 'automation.run-publisher' },
] as const;

describe.each(RUNS)('POST $url', ({ url, queue, job, action }) => {
  it('sem login => 401 e nada é enfileirado', async () => {
    const res = await app.inject({ method: 'POST', url });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    expect(await getQueue(queue).getJobCounts('waiting', 'delayed', 'active')).toEqual({ waiting: 0, delayed: 0, active: 0 });
  });

  it('com sessão mas sem CSRF (ou CSRF errado) => 403 CSRF_INVALID e nada é enfileirado/auditado', async () => {
    for (const headers of [{ cookie: agent.cookie }, { cookie: agent.cookie, 'x-csrf-token': 'errado' }, { 'x-csrf-token': agent.csrf }]) {
      const res = await app.inject({ method: 'POST', url, headers });
      expect([401, 403]).toContain(res.statusCode); // sem cookie => 401; com cookie e CSRF ruim => 403
      if (res.statusCode === 403) expect(res.json().error.code).toBe('CSRF_INVALID');
    }
    expect(await getQueue(queue).getJobCounts('waiting', 'delayed', 'active')).toEqual({ waiting: 0, delayed: 0, active: 0 });
    expect(await prisma.auditLog.count({ where: { action } })).toBe(0);
  });

  it('GET não existe nesta rota (só POST)', async () => {
    expect((await agent.get(url)).statusCode).toBe(404);
  });

  it('perfil VIEWER => 403 FORBIDDEN', async () => {
    await createTestAdmin({ email: 'viewer@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'viewer@teste.local' });
    const res = await viewer.post(url);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await getQueue(queue).getJobCounts('waiting')).toEqual({ waiting: 0 });
  });

  it('admin autenticado com CSRF => { queued:true, jobId, alreadyQueued:false }, job manual na fila certa e auditoria', async () => {
    const res = await agent.post(url);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ queued: true, alreadyQueued: false });
    expect(body.jobId).toMatch(new RegExp(`^manual-${job}-`));
    const queued = await getQueue(queue).getJob(body.jobId);
    expect(queued?.name).toBe(job);
    expect(queued?.data).toEqual({ trigger: 'manual', requestedBy: agent.user.id });
    expect(await queued!.getState()).toBe('waiting');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action } });
    expect(audit).toMatchObject({ userId: agent.user.id, entity: 'ScheduledJob' });
    expect(audit.ip).toBeTruthy();
  });

  it('cliques repetidos não acumulam: devolve o mesmo job (alreadyQueued) e continua auditando', async () => {
    const first = (await agent.post(url)).json();
    const second = (await agent.post(url)).json();
    const third = (await agent.post(url)).json();
    expect(second).toMatchObject({ queued: true, alreadyQueued: true, jobId: first.jobId });
    expect(third.jobId).toBe(first.jobId);
    expect(await getQueue(queue).getJobCounts('waiting')).toEqual({ waiting: 1 });
    expect(await prisma.auditLog.count({ where: { action } })).toBe(3);
  });
});

describe('as duas execuções manuais são independentes', () => {
  it('discovery e publish-tick usam filas e jobs diferentes', async () => {
    const a = (await agent.post('/api/automation/run-discovery')).json();
    const b = (await agent.post('/api/automation/run-publisher')).json();
    expect(a.jobId).not.toBe(b.jobId);
    expect(b.alreadyQueued).toBe(false);
    expect(await getQueue('discovery').getJobCounts('waiting')).toEqual({ waiting: 1 });
    expect(await getQueue('publish').getJobCounts('waiting')).toEqual({ waiting: 1 });
  });
});

describe('POST /api/automation/apply', () => {
  it('exige login + CSRF e reaplica os agendadores conforme as settings', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/automation/apply' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/automation/apply', headers: { cookie: agent.cookie } })).statusCode).toBe(403);

    const off = await agent.post('/api/automation/apply');
    expect(off.statusCode).toBe(200);
    expect(off.json().schedules.map((s: any) => [s.name, s.action])).toEqual([
      ['discovery', 'absent'],
      ['publish-tick', 'created'],
      ['maintenance', 'created'],
      ['health', 'created'],
    ]);
    await updateSettings({ monitoring: { enabled: true, intervalMinutes: 5 } });
    const on = await agent.post('/api/automation/apply');
    expect(on.json().schedules[0]).toMatchObject({ name: 'discovery', action: 'created', everyMs: 300_000 });
    expect(await getQueue('discovery').getJobScheduler('discovery')).toMatchObject({ every: 300_000 });
  });

  it('PUT /api/settings reaplica os agendadores sozinho (liga e desliga a descoberta)', async () => {
    const put = await agent.put('/api/settings', { monitoring: { enabled: true, intervalMinutes: 12 } });
    expect(put.statusCode).toBe(200);
    await waitUntil(async () => (await getQueue('discovery').getJobScheduler('discovery'))?.every === 12 * 60_000);
    await agent.put('/api/settings', { monitoring: { enabled: false } });
    await waitUntil(async () => !(await getQueue('discovery').getJobScheduler('discovery')));
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).enabled).toBe(false);
  });
});

async function waitUntil(fn: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const t0 = Date.now();
  while (!(await fn())) {
    if (Date.now() - t0 > timeoutMs) throw new Error('waitUntil: tempo esgotado');
    await new Promise((r) => setTimeout(r, 50));
  }
}
