/**
 * Rotas /api/publications*: listagem, fila manual, detalhe com tentativas, retry/cancel/mark-sent, exigência de
 * login + CSRF e o fluxo ponta a ponta oferta -> publicação (/api/offers/:id/publish) pela API.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { closeQueues, getQueue } from '../../src/queues/queues.js';
import { setOfferSourceProvider } from '../../src/services/policy.js';
import { updateSettings } from '../../src/services/settings.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb, resetRedis } from '../helpers/db.js';
import { DAY, HOUR, ago, seedChannel, seedManualChannel, seedOffer, seedPublication } from '../helpers/publishing-fixtures.js';

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
  setOfferSourceProvider(async () => null);
  await updateSettings({ publishing: { minIntervalMinutes: 0, maxPerHour: 100, maxPerDay: 100, maxPerCategoryPerDay: 100, quietHours: { enabled: false } } });
});
afterEach(() => setOfferSourceProvider(null));

const webhook = () => seedChannel('WEBHOOK', { name: 'Webhook', config: { url: 'https://hooks.exemplo.test/x' } });

describe('autenticação e CSRF', () => {
  const routes: [string, string][] = [
    ['GET', '/api/publications'],
    ['GET', '/api/publications/manual-queue'],
    ['GET', '/api/publications/abc'],
    ['POST', '/api/publications/abc/retry'],
    ['POST', '/api/publications/abc/cancel'],
    ['POST', '/api/publications/abc/mark-sent'],
  ];
  it('sem login: 401 em todas', async () => {
    for (const [method, url] of routes) {
      const res = await app.inject({ method: method as 'GET', url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    }
  });

  it('mutações sem token CSRF (ou com token errado) => 403 CSRF_INVALID e nenhuma mudança de estado', async () => {
    const ch = await seedManualChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'MANUAL_READY' });
    for (const action of ['retry', 'cancel', 'mark-sent']) {
      for (const headers of [{ cookie: agent.cookie }, { cookie: agent.cookie, 'x-csrf-token': 'invalido' }]) {
        const res = await app.inject({ method: 'POST', url: `/api/publications/${pub.id}/${action}`, headers });
        expect(res.statusCode, action).toBe(403);
        expect(res.json().error.code).toBe('CSRF_INVALID');
      }
    }
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe('MANUAL_READY');
    expect(await prisma.auditLog.count({ where: { action: { startsWith: 'publication.' } } })).toBe(0);
  });

  it('perfil VIEWER consulta, mas não opera publicações (403 FORBIDDEN)', async () => {
    await createTestAdmin({ email: 'viewer@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'viewer@teste.local' });
    const ch = await seedManualChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'MANUAL_READY' });
    expect((await viewer.get('/api/publications')).statusCode).toBe(200);
    expect((await viewer.get('/api/publications/manual-queue')).statusCode).toBe(200);
    for (const action of ['retry', 'cancel', 'mark-sent']) {
      const res = await viewer.post(`/api/publications/${pub.id}/${action}`);
      expect(res.statusCode, action).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    }
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe('MANUAL_READY');
  });
});

describe('GET /api/publications', () => {
  async function seedMany() {
    const auto = await webhook();
    const manual = await seedManualChannel();
    const rows = [];
    const plan: [typeof auto, 'SENT' | 'FAILED' | 'DEAD' | 'MANUAL_READY' | 'PENDING'][] = [
      [auto, 'SENT'],
      [auto, 'FAILED'],
      [auto, 'DEAD'],
      [manual, 'MANUAL_READY'],
      [manual, 'PENDING'],
    ];
    let i = 0;
    for (const [ch, status] of plan) {
      const s = await seedOffer({ title: `Produto ${++i}` });
      rows.push(await seedPublication(s.offer, ch, s.link, { status, createdAt: ago((10 - i) * HOUR, new Date()), ...(status === 'SENT' ? { sentAt: ago(HOUR, new Date()), externalMessageId: 'x' } : {}) }));
    }
    return { auto, manual, rows };
  }

  it('devolve { items, total, page, pageSize } com PublicationDTO, mais recentes primeiro', async () => {
    const { rows } = await seedMany();
    const res = await agent.get('/api/publications');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ total: 5, page: 1, pageSize: 20 });
    expect(body.items.map((x: any) => x.id)).toEqual([...rows].reverse().map((r) => r.id));
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['attemptsCount', 'channelId', 'channelName', 'channelType', 'createdAt', 'id', 'imageUrl', 'lastError', 'messageText', 'offerId', 'productTitle', 'scheduledFor', 'sentAt', 'status', 'template'].sort(),
    );
    const sent = body.items.find((x: any) => x.status === 'SENT');
    expect(sent).toMatchObject({ channelType: 'WEBHOOK', channelName: 'Webhook', productTitle: 'Produto 1' });
    expect(typeof sent.sentAt).toBe('string');
  });

  it('filtra por status (qualquer caixa) e por canal; pagina; recusa status inválido', async () => {
    const { auto, manual } = await seedMany();
    expect((await agent.get('/api/publications?status=sent')).json()).toMatchObject({ total: 1 });
    expect((await agent.get('/api/publications?status=DEAD')).json().items[0]).toMatchObject({ status: 'DEAD' });
    expect((await agent.get(`/api/publications?channelId=${auto.id}`)).json().total).toBe(3);
    expect((await agent.get(`/api/publications?channelId=${manual.id}&status=MANUAL_READY`)).json().total).toBe(1);
    expect((await agent.get('/api/publications?status=')).json().total).toBe(5); // vazio = sem filtro
    const page = (await agent.get('/api/publications?page=2&pageSize=2')).json();
    expect(page).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    const bad = await agent.get('/api/publications?status=ENVIADA');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('VALIDATION_ERROR');
    expect((await agent.get('/api/publications?pageSize=9999')).statusCode).toBe(400);
  });

  it('lista vazia é honesta (sem dados fictícios)', async () => {
    expect((await agent.get('/api/publications')).json()).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect((await agent.get('/api/publications/manual-queue')).json()).toEqual([]);
  });
});

describe('GET /api/publications/manual-queue e /:id', () => {
  it('fila manual: só MANUAL_READY, melhores scores primeiro, com texto pronto e imagem', async () => {
    const manual = await seedManualChannel();
    const auto = await webhook();
    const mk = async (score: number, status: 'MANUAL_READY' | 'SENT' | 'CANCELLED', ch = manual) => {
      const s = await seedOffer({ score, title: `Item S${score}` });
      return seedPublication(s.offer, ch, s.link, { status, messageText: `mensagem S${score} https://meli.la/x`, ...(status === 'SENT' ? { sentAt: ago(DAY, new Date()) } : {}) });
    };
    await mk(70, 'MANUAL_READY');
    await mk(95, 'MANUAL_READY');
    await mk(80, 'SENT');
    await mk(99, 'CANCELLED');
    await mk(60, 'MANUAL_READY', auto); // MANUAL_READY num canal qualquer também aparece (estado é o que vale)
    const res = await agent.get('/api/publications/manual-queue');
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.map((x: any) => x.productTitle)).toEqual(['Item S95', 'Item S70', 'Item S60']);
    expect(items[0]).toMatchObject({ status: 'MANUAL_READY', messageText: 'mensagem S95 https://meli.la/x', channelType: 'WHATSAPP_MANUAL_QUEUE' });
    expect(items[0]).toHaveProperty('imageUrl');
  });

  it('detalhe devolve o DTO + attempts (ordem cronológica, sem segredos); 404 para id inexistente', async () => {
    const ch = await webhook();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'FAILED', attemptsCount: 2 });
    await prisma.publicationAttempt.create({ data: { publicationId: pub.id, startedAt: ago(2 * HOUR, new Date()), finishedAt: ago(2 * HOUR, new Date()), success: false, httpStatus: 500, error: 'HTTP 500', response: { status: 500 } } });
    await prisma.publicationAttempt.create({ data: { publicationId: pub.id, startedAt: ago(HOUR, new Date()), finishedAt: ago(HOUR, new Date()), success: false, httpStatus: 429, error: 'limite' } });
    const res = await agent.get(`/api/publications/${pub.id}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ id: pub.id, status: 'FAILED', attemptsCount: 2 });
    expect(body.attempts.map((a: any) => a.httpStatus)).toEqual([500, 429]);
    expect(body.attempts[0]).toMatchObject({ success: false, error: 'HTTP 500', response: { status: 500 } });
    expect(Object.keys(body.attempts[0]).sort()).toEqual(['error', 'finishedAt', 'httpStatus', 'id', 'response', 'startedAt', 'success']);
    const missing = await agent.get('/api/publications/nao-existe');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/publications/:id/retry', () => {
  it('DEAD/FAILED/CANCELLED => PENDING com tentativas zeradas, auditoria e job de envio imediato na fila', async () => {
    const ch = await webhook();
    for (const status of ['DEAD', 'FAILED', 'CANCELLED'] as const) {
      const s = await seedOffer();
      const pub = await seedPublication(s.offer, ch, s.link, { status, attemptsCount: 5 });
      await prisma.publication.update({ where: { id: pub.id }, data: { lastError: 'falhou' } });
      const res = await agent.post(`/api/publications/${pub.id}/retry`);
      expect(res.statusCode, status).toBe(200);
      expect(res.json()).toMatchObject({ id: pub.id, status: 'PENDING', attemptsCount: 0, lastError: null, scheduledFor: null });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'publication.retry', entityId: pub.id } });
      expect(audit).toMatchObject({ userId: agent.user.id, entity: 'Publication', before: { status } });
      const job = await getQueue('publish').getJob(`send-${pub.id}`);
      expect(job?.name).toBe('send-publication');
      expect(job?.data).toEqual({ publicationId: pub.id });
    }
  });

  it('só reenvia o que falhou: SENT, PENDING, SENDING e MANUAL_READY => 409 PUBLICATION_NOT_RETRYABLE', async () => {
    const ch = await webhook();
    for (const status of ['SENT', 'PENDING', 'SENDING', 'MANUAL_READY'] as const) {
      const s = await seedOffer();
      const pub = await seedPublication(s.offer, ch, s.link, { status, ...(status === 'SENT' ? { sentAt: ago(DAY, new Date()) } : {}) });
      const res = await agent.post(`/api/publications/${pub.id}/retry`);
      expect(res.statusCode, status).toBe(409);
      expect(res.json().error.code).toBe('PUBLICATION_NOT_RETRYABLE');
      expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe(status);
    }
  });

  it('item da fila manual só volta se link validado/oferta aprovada/produto ativo (409 com o código da trava)', async () => {
    const manual = await seedManualChannel();
    const a = await seedOffer({ link: 'INVALID' });
    const pa = await seedPublication(a.offer, manual, a.link, { status: 'CANCELLED' });
    const ra = await agent.post(`/api/publications/${pa.id}/retry`);
    expect(ra.statusCode).toBe(409);
    expect(ra.json().error.code).toBe('NO_VALIDATED_LINK');

    const b = await seedOffer({ offerStatus: 'REJECTED' });
    const pb = await seedPublication(b.offer, manual, b.link, { status: 'CANCELLED' });
    expect((await agent.post(`/api/publications/${pb.id}/retry`)).json().error.code).toBe('OFFER_NOT_APPROVED');

    const c = await seedOffer();
    const pc = await seedPublication(c.offer, manual, c.link, { status: 'CANCELLED' });
    expect((await agent.post(`/api/publications/${pc.id}/retry`)).json()).toMatchObject({ status: 'MANUAL_READY' });
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pa.id } })).status).toBe('CANCELLED');
    expect(await prisma.auditLog.count({ where: { action: 'publication.retry' } })).toBe(1);
  });

  it('inexistente => 404', async () => {
    expect((await agent.post('/api/publications/nao-existe/retry')).statusCode).toBe(404);
  });
});

describe('POST /api/publications/:id/cancel', () => {
  it('cancela PENDING/SCHEDULED/FAILED/DEAD/MANUAL_READY (a oferta volta a APPROVED) e audita', async () => {
    const ch = await webhook();
    for (const status of ['PENDING', 'SCHEDULED', 'FAILED', 'DEAD', 'MANUAL_READY'] as const) {
      const s = await seedOffer({ offerStatus: 'QUEUED' });
      const pub = await seedPublication(s.offer, ch, s.link, { status });
      const res = await agent.post(`/api/publications/${pub.id}/cancel`);
      expect(res.statusCode, status).toBe(200);
      expect(res.json()).toMatchObject({ id: pub.id, status: 'CANCELLED' });
      expect((await prisma.offer.findUniqueOrThrow({ where: { id: s.offer.id } })).status).toBe('APPROVED');
      expect(await prisma.auditLog.count({ where: { action: 'publication.cancel', entityId: pub.id } })).toBe(1);
    }
  });

  it('já cancelada é idempotente (200, sem nova auditoria); SENT => 409 PUBLICATION_ALREADY_SENT; SENDING => 409 PUBLICATION_SENDING', async () => {
    const ch = await webhook();
    const mk = async (status: 'CANCELLED' | 'SENT' | 'SENDING') => {
      const s = await seedOffer();
      return seedPublication(s.offer, ch, s.link, { status, ...(status === 'SENT' ? { sentAt: ago(DAY, new Date()) } : {}) });
    };
    const c = await mk('CANCELLED');
    expect((await agent.post(`/api/publications/${c.id}/cancel`)).statusCode).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'publication.cancel' } })).toBe(0);
    const sent = await mk('SENT');
    const r1 = await agent.post(`/api/publications/${sent.id}/cancel`);
    expect(r1.statusCode).toBe(409);
    expect(r1.json().error.code).toBe('PUBLICATION_ALREADY_SENT');
    const sending = await mk('SENDING');
    const r2 = await agent.post(`/api/publications/${sending.id}/cancel`);
    expect(r2.statusCode).toBe(409);
    expect(r2.json().error.code).toBe('PUBLICATION_SENDING');
    expect((await agent.post('/api/publications/nao-existe/cancel')).statusCode).toBe(404);
  });
});

describe('POST /api/publications/:id/mark-sent (fila manual)', () => {
  it('MANUAL_READY => SENT por confirmação humana, com id "manual:<usuário>", oferta PUBLISHED e UMA auditoria', async () => {
    const manual = await seedManualChannel();
    const s = await seedOffer({ offerStatus: 'QUEUED' });
    const pub = await seedPublication(s.offer, manual, s.link, { status: 'MANUAL_READY' });
    const res = await agent.post(`/api/publications/${pub.id}/mark-sent`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: pub.id, status: 'SENT', attemptsCount: 1 });
    expect(typeof res.json().sentAt).toBe('string');
    const row = await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(row.externalMessageId).toBe(`manual:${agent.user.id}`);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: s.offer.id } })).status).toBe('PUBLISHED');
    // exatamente uma entrada de auditoria por confirmação (o serviço e a rota não podem duplicá-la)
    expect(await prisma.auditLog.count({ where: { action: 'publication.mark-sent', entityId: pub.id } })).toBe(1);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: 'publication.mark-sent' } })).userId).toBe(agent.user.id);
  });

  it('é idempotente: repetir devolve SENT sem contar de novo nem auditar de novo', async () => {
    const manual = await seedManualChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, manual, s.link, { status: 'MANUAL_READY' });
    await agent.post(`/api/publications/${pub.id}/mark-sent`);
    const again = await agent.post(`/api/publications/${pub.id}/mark-sent`);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ status: 'SENT', attemptsCount: 1 });
    expect(await prisma.auditLog.count({ where: { action: 'publication.mark-sent' } })).toBe(1);
  });

  it('só MANUAL_READY pode ser marcada: PENDING/CANCELLED/envio automático => 409 PUBLICATION_NOT_MANUAL_READY; inexistente => 404', async () => {
    const ch = await webhook();
    for (const status of ['PENDING', 'CANCELLED', 'FAILED', 'DEAD'] as const) {
      const s = await seedOffer();
      const pub = await seedPublication(s.offer, ch, s.link, { status });
      const res = await agent.post(`/api/publications/${pub.id}/mark-sent`);
      expect(res.statusCode, status).toBe(409);
      expect(res.json().error.code).toBe('PUBLICATION_NOT_MANUAL_READY');
      expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe(status);
    }
    const auto = await seedOffer();
    const sentAuto = await seedPublication(auto.offer, ch, auto.link, { status: 'SENT', sentAt: ago(DAY, new Date()), externalMessageId: 'wamid.1' });
    expect((await agent.post(`/api/publications/${sentAuto.id}/mark-sent`)).statusCode).toBe(409);
    expect((await agent.post('/api/publications/nao-existe/mark-sent')).statusCode).toBe(404);
  });
});

describe('fluxo pela API: oferta -> fila manual -> marcada como publicada (Modo B)', () => {
  it('POST /offers/:id/publish gera MANUAL_READY (nunca SENT), aparece na fila e só vira SENT com o mark-sent', async () => {
    const manual = await seedManualChannel();
    const s = await seedOffer({ title: 'Air Fryer 4L Digital' });
    const pub = await agent.post(`/api/offers/${s.offer.id}/publish`, { channelId: manual.id });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().publications).toHaveLength(1);
    expect(pub.json().publications[0]).toMatchObject({ status: 'MANUAL_READY', sentAt: null, channelType: 'WHATSAPP_MANUAL_QUEUE', productTitle: 'Air Fryer 4L Digital' });
    expect(pub.json().publications[0].messageText).toContain(s.link!.url);
    expect(pub.json().offer.status).toBe('QUEUED');

    const queue = (await agent.get('/api/publications/manual-queue')).json();
    expect(queue.map((x: any) => x.id)).toEqual([pub.json().publications[0].id]);
    expect((await agent.get('/api/publications?status=SENT')).json().total).toBe(0);

    const done = await agent.post(`/api/publications/${queue[0].id}/mark-sent`);
    expect(done.json().status).toBe('SENT');
    expect((await agent.get('/api/publications/manual-queue')).json()).toEqual([]);
    expect((await agent.get(`/api/offers/${s.offer.id}`)).json().status).toBe('PUBLISHED');
    // publicar de novo a mesma oferta no mesmo canal é duplicidade
    const dup = await agent.post(`/api/offers/${s.offer.id}/publish`, { channelId: manual.id });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('DUPLICATE');
  });

  it('sem link validado a API responde 409 NO_VALIDATED_LINK e não cria nada', async () => {
    const manual = await seedManualChannel();
    const s = await seedOffer({ link: 'PENDING' });
    const res = await agent.post(`/api/offers/${s.offer.id}/publish`, { channelId: manual.id });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: 'NO_VALIDATED_LINK' });
    expect(res.json().error.message).toMatch(/Publicação bloqueada/);
    expect(await prisma.publication.count()).toBe(0);
  });

  it('as demais travas chegam como 409 com código: oferta não aprovada, produto suspenso, canal desabilitado, fora da janela', async () => {
    const manual = await seedManualChannel();
    const off = await seedChannel('WEBHOOK', { enabled: false, config: { url: 'https://hooks.exemplo.test/x' } });
    const rejected = await seedOffer({ offerStatus: 'REJECTED' });
    expect((await agent.post(`/api/offers/${rejected.offer.id}/publish`, { channelId: manual.id })).json().error.code).toBe('OFFER_NOT_APPROVED');
    const suspended = await seedOffer({ productStatus: 'SUSPENDED' });
    expect((await agent.post(`/api/offers/${suspended.offer.id}/publish`, { channelId: manual.id })).json().error.code).toBe('SUSPENDED_PRODUCT');
    const ok = await seedOffer();
    expect((await agent.post(`/api/offers/${ok.offer.id}/publish`, { channelId: off.id })).json().error.code).toBe('CHANNEL_DISABLED');
    await updateSettings({ publishing: { quietHours: { enabled: true, start: '00:00', end: '23:59' } } });
    const res = await agent.post(`/api/offers/${ok.offer.id}/publish`, { channelId: manual.id });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('OUT_OF_WINDOW');
  });
});
