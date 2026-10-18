import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { recordAudit } from '../../src/services/audit.js';
import { logEvent } from '../../src/services/logs.js';
import { countUnread, notify } from '../../src/services/notifications.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

let app: FastifyInstance;
let agent: TestAgent;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await createTestAdmin();
  agent = await loginAgent(app);
});

describe('logEvent: sanitização de segredos', () => {
  it('nenhum segredo chega ao banco nem à API (chaves sensíveis e texto)', async () => {
    await logEvent('ERROR', 'telegram', 'falha em https://api.telegram.org/bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/sendMessage?access_token=SEGREDO-URL', {
      access_token: 'SEGREDO-AT',
      refresh_token: 'SEGREDO-RT',
      headers: { Authorization: 'Bearer SEGREDO-BEARER-123456', cookie: 'achados_sid=SEGREDO-COOKIE' },
      credentials: { botToken: 'SEGREDO-BOT', password: 'SEGREDO-PW' },
      error: new Error('401 com Bearer SEGREDO-ERRO-9876543210'),
      keep: { chatId: '-100123', status: 401 },
    });
    const rows = await prisma.systemLog.findMany();
    expect(rows).toHaveLength(1);
    const dump = JSON.stringify(rows);
    for (const leaked of ['SEGREDO-URL', 'SEGREDO-AT', 'SEGREDO-RT', 'SEGREDO-BEARER', 'SEGREDO-COOKIE', 'SEGREDO-BOT', 'SEGREDO-PW', 'SEGREDO-ERRO', 'AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw']) {
      expect(dump).not.toContain(leaked);
    }
    // dados úteis permanecem
    expect((rows[0]!.meta as any).keep).toEqual({ chatId: '-100123', status: 401 });
    expect(rows[0]!.level).toBe('ERROR');

    const api = await agent.get('/api/logs');
    expect(api.statusCode).toBe(200);
    expect(api.body).not.toContain('SEGREDO');
  });

  it('aceita nível em minúsculas, limita meta enorme e nunca lança', async () => {
    await logEvent('info', 'teste', 'oi', { grande: 'x'.repeat(50_000), n: 1 });
    const row = await prisma.systemLog.findFirstOrThrow();
    expect(row.level).toBe('INFO');
    expect(JSON.stringify(row.meta).length).toBeLessThan(20_000);
    await expect(logEvent('WARN', 'teste', 'ok', { circular: (() => { const o: any = {}; o.o = o; return o; })() })).resolves.toBeUndefined();
  });
});

describe('GET /api/logs e /api/audit', () => {
  it('filtra por nível/escopo e pagina no formato do contrato', async () => {
    for (let i = 0; i < 5; i++) await logEvent('INFO', 'discovery', `evento ${i}`);
    await logEvent('ERROR', 'publishing', 'falhou');
    await logEvent('WARN', 'discovery', 'atenção');

    const all = (await agent.get('/api/logs?pageSize=3&page=1')).json();
    expect(all).toMatchObject({ total: 7, page: 1, pageSize: 3 });
    expect(all.items).toHaveLength(3);
    expect(all.items[0]).toMatchObject({ message: 'atenção', level: 'WARN', scope: 'discovery' });
    expect(typeof all.items[0].createdAt).toBe('string');

    expect((await agent.get('/api/logs?level=error')).json().items.map((i: any) => i.message)).toEqual(['falhou']);
    expect((await agent.get('/api/logs?scope=discovery&pageSize=100')).json().total).toBe(6);
    expect((await agent.get('/api/logs?page=2&pageSize=3')).json().items).toHaveLength(3);
  });

  it('valida a query (nível inexistente, página inválida)', async () => {
    expect((await agent.get('/api/logs?level=BANANA')).statusCode).toBe(400);
    expect((await agent.get('/api/logs?page=0')).statusCode).toBe(400);
    expect((await agent.get('/api/logs?pageSize=1000')).statusCode).toBe(400);
  });

  it('auditoria nunca guarda segredos em before/after', async () => {
    await recordAudit({ action: 'credential.create', entity: 'IntegrationCredential', entityId: 'x', after: { name: 'bot', values: { botToken: 'SEGREDO-AUD' }, password: 'SEGREDO-PW2' } });
    const res = await agent.get('/api/audit');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ page: 1, pageSize: 20 });
    expect(res.body).not.toContain('SEGREDO');
    expect(res.json().items.find((i: any) => i.action === 'credential.create').after.name).toBe('bot');
  });
});

describe('notificações', () => {
  it('notify cria alerta; dedupeKey ignora repetição enquanto houver não lido', async () => {
    await notify({ level: 'WARN', type: 'integration_auth_required', title: 'Mercado Livre exige autenticação', dedupeKey: 'ml-auth' });
    await notify({ level: 'WARN', type: 'integration_auth_required', title: 'Mercado Livre exige autenticação', dedupeKey: 'ml-auth' });
    await notify({ level: 'ERROR', type: 'job_stuck', title: 'Job travado', body: 'discovery há 20 min' });
    await notify({ level: 'ERROR', type: 'job_stuck', title: 'Job travado', body: 'discovery há 20 min' }); // sem chave: duplica
    expect(await prisma.notification.count()).toBe(3);
    expect(await countUnread()).toBe(3);
  });

  it('após lido, o mesmo dedupeKey volta a alertar', async () => {
    await notify({ type: 't', title: 'primeiro', dedupeKey: 'k' });
    const [n] = (await agent.get('/api/notifications')).json();
    expect((await agent.post(`/api/notifications/${n.id}/read`)).json()).toEqual({ ok: true });
    expect(await countUnread()).toBe(0);
    await notify({ type: 't', title: 'de novo', dedupeKey: 'k' });
    expect(await countUnread()).toBe(1);
    expect((await prisma.notification.findFirstOrThrow()).title).toBe('de novo');
  });

  it('chamadas concorrentes com a mesma chave geram um único alerta', async () => {
    await Promise.all(Array.from({ length: 8 }, () => notify({ type: 't', title: 'corrida', dedupeKey: 'race' })));
    expect(await prisma.notification.count({ where: { dedupeKey: 'race' } })).toBe(1);
  });

  it('API: lista (array), filtra não lidas, marca lida, read-all e 404', async () => {
    await notify({ level: 'INFO', type: 'a', title: 'A' });
    await notify({ level: 'ERROR', type: 'b', title: 'B' });
    const list = (await agent.get('/api/notifications')).json();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ title: 'B', level: 'ERROR', read: false });

    expect((await agent.post(`/api/notifications/${list[0].id}/read`)).statusCode).toBe(200);
    expect((await agent.get('/api/notifications?unread=true')).json().map((n: any) => n.title)).toEqual(['A']);
    expect((await agent.post('/api/notifications/nao-existe/read')).statusCode).toBe(404);
    expect((await agent.post('/api/notifications/read-all')).json()).toEqual({ ok: true, count: 1 });
    expect((await agent.get('/api/notifications?unread=true')).json()).toEqual([]);
  });

  it('título/corpo passam pelo sanitizador de segredos', async () => {
    await notify({ type: 'x', title: 'erro com access_token=SEGREDO-N', body: 'Bearer SEGREDO-BEARER-123456789' });
    const row = await prisma.notification.findFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain('SEGREDO');
  });
});
