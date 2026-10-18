/**
 * /api/dashboard e /api/reports/summary: exigem login; os números vêm do banco (conferidos contra dados semeados
 * com contagens conhecidas); métricas de afiliados (cliques/vendas/comissões) NÃO existem => available=false.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encryptJson } from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/db.js';
import { dayKeyInTz } from '../../src/lib/time.js';
import { AFFILIATE_METRICS_REASON, SERIES_DAYS } from '../../src/services/reporting.js';
import { updateSettings } from '../../src/services/settings.js';
import { seedLinkFor, seedManualChannel, seedMlProduct, seedOfferFor } from '../helpers/affiliate-fixtures.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

let app: FastifyInstance;
let agent: TestAgent;
const TZ = 'America/Sao_Paulo';
const H = 3_600_000;
const D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms);

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

async function pub(offerId: string, channelId: string, linkId: string, status: 'SENT' | 'FAILED' | 'DEAD' | 'PENDING' | 'SCHEDULED' | 'SENDING' | 'MANUAL_READY' | 'CANCELLED', sentAt?: Date) {
  return prisma.publication.create({
    data: {
      offerId,
      channelId,
      status,
      template: 'COMMON',
      messageText: 'x',
      affiliateLinkId: linkId,
      idempotencyKey: `${offerId}:${channelId}:${status}:${Math.random()}`,
      ...(sentAt ? { sentAt } : {}),
    },
  });
}

describe('autenticação', () => {
  it('dashboard e relatório exigem sessão (401)', async () => {
    for (const url of ['/api/dashboard', '/api/reports/summary', '/api/reports/summary?days=7']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    }
  });

  it('VIEWER (somente leitura) consegue ler os dois', async () => {
    await createTestAdmin({ email: 'leitor@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'leitor@teste.local' });
    expect((await viewer.get('/api/dashboard')).statusCode).toBe(200);
    expect((await viewer.get('/api/reports/summary')).statusCode).toBe(200);
  });
});

describe('GET /api/dashboard', () => {
  it('banco vazio: estados vazios honestos (zeros, sem jobs, fonte não configurada) e série contínua', async () => {
    const res = await agent.get('/api/dashboard');
    expect(res.statusCode).toBe(200);
    const d = res.json();
    expect(d.monitoring).toEqual({ enabled: false, status: 'IDLE', lastRunAt: null, lastSuccessAt: null, lastError: null, intervalMinutes: 10 });
    expect(d.autoPublish).toBe(false);
    expect(d.integrations).toEqual([]);
    expect(d.jobs).toEqual([]);
    expect(d.today).toEqual({ discovered: 0, approved: 0, published: 0, pending: 0, failed: 0 });
    expect(d.pendingAffiliateLinks).toBe(0);
    expect(d.unreadNotifications).toBe(0);
    expect(d.source).toMatchObject({ name: 'Mercado Livre (API oficial)', status: 'NOT_CONFIGURED' });
    expect(d.source.detail).toMatch(/não configuradas/);
    expect(d.series).toHaveLength(SERIES_DAYS);
    expect(d.series.every((s: { discovered: number; approved: number; published: number }) => s.discovered === 0 && s.approved === 0 && s.published === 0)).toBe(true);
  });

  it('série: 14 dias consecutivos terminando em hoje (fuso das configurações), sem repetir datas', async () => {
    const d = (await agent.get('/api/dashboard')).json();
    const dates: string[] = d.series.map((s: { date: string }) => s.date);
    expect(dates[dates.length - 1]).toBe(dayKeyInTz(new Date(), TZ));
    expect(new Set(dates).size).toBe(SERIES_DAYS);
    expect([...dates].sort()).toEqual(dates);
    for (let i = 1; i < dates.length; i++) {
      const gap = (Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`)) / D;
      expect(gap).toBe(1);
    }
  });

  it('contadores do dia e série batem com o banco (contagens semeadas conhecidas)', async () => {
    const channel = await seedManualChannel();
    const p1 = await seedMlProduct({ title: 'P1 sem link' });
    const p2 = await seedMlProduct({ title: 'P2 com link validado' });
    const p3 = await seedMlProduct({ title: 'P3 publicado' });
    const link2 = await seedLinkFor(p2.id);
    const link3 = await seedLinkFor(p3.id);
    // hoje: 3 descobertas (DISCOVERED, APPROVED, PUBLISHED); 2 aprovadas hoje (APPROVED, PUBLISHED); 1 rejeitada hoje
    await seedOfferFor(p1.id, { status: 'DISCOVERED' });
    const o2 = await seedOfferFor(p2.id, { status: 'APPROVED', decidedAt: new Date(), decidedBy: 'u' });
    const o3 = await seedOfferFor(p3.id, { status: 'PUBLISHED', decidedAt: new Date(), decidedBy: 'u' });
    await seedOfferFor(p1.id, { status: 'REJECTED', decidedAt: new Date(), decidedBy: 'u', discoveredAt: ago(40 * H) });
    // ontem/antes: não contam em "hoje"
    await seedOfferFor(p2.id, { status: 'APPROVED', decidedAt: ago(30 * H), discoveredAt: ago(30 * H) });
    await seedOfferFor(p3.id, { status: 'DISCOVERED', discoveredAt: ago(3 * D) });

    // publicações: 1 enviada hoje, 1 enviada ontem; 4 pendentes (PENDING, SCHEDULED, SENDING, MANUAL_READY); 2 falhas hoje; 1 cancelada
    await pub(o3.id, channel.id, link3.id, 'SENT', new Date());
    await pub(o3.id, channel.id, link3.id, 'SENT', ago(30 * H));
    for (const s of ['PENDING', 'SCHEDULED', 'SENDING', 'MANUAL_READY'] as const) await pub(o2.id, channel.id, link2.id, s);
    await pub(o2.id, channel.id, link2.id, 'FAILED');
    await pub(o2.id, channel.id, link2.id, 'DEAD');
    await pub(o2.id, channel.id, link2.id, 'CANCELLED');
    await prisma.notification.createMany({ data: [{ type: 'a', title: 'não lida 1' }, { type: 'b', title: 'não lida 2' }, { type: 'c', title: 'lida', readAt: new Date() }] });

    const d = (await agent.get('/api/dashboard')).json();
    expect(d.today).toEqual({ discovered: 3, approved: 2, published: 1, pending: 4, failed: 2 });
    expect(d.pendingAffiliateLinks).toBe(1); // só P1 tem oferta aberta e nenhum link validado
    expect(d.unreadNotifications).toBe(2);

    const today = d.series[d.series.length - 1];
    expect(today).toEqual({ date: dayKeyInTz(new Date(), TZ), discovered: 3, approved: 2, published: 1 });
    // a soma da série cobre todas as ofertas semeadas (todas dentro de 14 dias)
    const sum = (k: 'discovered' | 'approved' | 'published') => d.series.reduce((a: number, s: Record<string, number>) => a + s[k]!, 0);
    expect(sum('discovered')).toBe(await prisma.offer.count());
    expect(sum('approved')).toBe(await prisma.offer.count({ where: { decidedAt: { not: null }, status: { in: ['APPROVED', 'QUEUED', 'PUBLISHED'] } } }));
    expect(sum('published')).toBe(await prisma.publication.count({ where: { status: 'SENT' } }));
    // o dia de "ontem" na série recebe a oferta aprovada de 30h atrás e o envio de 30h atrás
    const thirtyHoursAgoKey = dayKeyInTz(ago(30 * H), TZ);
    const bucket = d.series.find((s: { date: string }) => s.date === thirtyHoursAgoKey);
    expect(bucket.published).toBe(1);
    expect(bucket.approved).toBeGreaterThanOrEqual(1);
  });

  it('monitoramento e jobs vêm do ScheduledJob real; autoPublish e intervalo vêm das configurações', async () => {
    await updateSettings({ monitoring: { enabled: true, intervalMinutes: 15 }, publishing: { autoPublish: true } });
    const run = new Date('2026-10-01T12:00:00.000Z');
    await prisma.scheduledJob.create({ data: { name: 'discovery', queue: 'discovery', status: 'FAILED', lastRunAt: run, lastSuccessAt: new Date('2026-10-01T11:00:00.000Z'), lastError: 'Mercado Livre negou o acesso (HTTP 403).', nextRunAt: new Date('2026-10-01T12:15:00.000Z') } });
    await prisma.scheduledJob.create({ data: { name: 'publish-tick', queue: 'publish', status: 'SUCCEEDED' } });
    const d = (await agent.get('/api/dashboard')).json();
    expect(d.monitoring).toEqual({ enabled: true, status: 'FAILED', lastRunAt: run.toISOString(), lastSuccessAt: '2026-10-01T11:00:00.000Z', lastError: 'Mercado Livre negou o acesso (HTTP 403).', intervalMinutes: 15 });
    expect(d.autoPublish).toBe(true);
    expect(d.jobs.map((j: { name: string }) => j.name)).toEqual(['discovery', 'publish-tick']);
    expect(d.jobs[0]).toEqual({ name: 'discovery', status: 'FAILED', lastRunAt: run.toISOString(), lastSuccessAt: '2026-10-01T11:00:00.000Z', lastError: 'Mercado Livre negou o acesso (HTTP 403).', nextRunAt: '2026-10-01T12:15:00.000Z' });
  });

  it('canais: status real, sem expor configuração nem segredos', async () => {
    const cred = await prisma.integrationCredential.create({ data: { provider: 'telegram', name: 'bot', encrypted: encryptJson({ botToken: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0' }), hint: '••••saw0' } });
    await prisma.publishingChannel.create({ data: { type: 'TELEGRAM', name: 'Telegram VIP', enabled: true, status: 'AUTH_REQUIRED', statusDetail: 'Token do bot recusado', config: { chatId: '@canal_teste' }, credentialId: cred.id, lastCheckedAt: new Date('2026-10-01T12:00:00Z') } });
    await seedManualChannel('Fila');
    const res = await agent.get('/api/dashboard');
    const d = res.json();
    expect(d.integrations).toHaveLength(2);
    expect(d.integrations[0]).toEqual({ id: expect.any(String), type: 'TELEGRAM', name: 'Telegram VIP', enabled: true, status: 'AUTH_REQUIRED', statusDetail: 'Token do bot recusado', lastCheckedAt: '2026-10-01T12:00:00.000Z' });
    expect(res.body).not.toContain('AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0');
    expect(res.body).not.toContain('@canal_teste');
  });

  it('fonte: NOT_CONFIGURED sem credenciais; com credencial usa o status real; "fixture" é sinalizada como TESTE', async () => {
    await prisma.integrationCredential.create({ data: { provider: 'mercadolivre', name: 'ML', encrypted: encryptJson({ clientId: 'cid-12345', clientSecret: 'secret-abcdefgh', refreshToken: 'RT-0' }), status: 'AUTH_REQUIRED' } });
    await prisma.scheduledJob.create({ data: { name: 'discovery', queue: 'discovery', status: 'FAILED', lastError: 'HTTP 403 simulado' } });
    const bad = (await agent.get('/api/dashboard')).json().source;
    expect(bad).toEqual({ name: 'Mercado Livre (API oficial)', status: 'AUTH_REQUIRED', detail: 'HTTP 403 simulado' });

    await prisma.integrationCredential.updateMany({ data: { status: 'CONNECTED' } });
    await prisma.scheduledJob.update({ where: { name: 'discovery' }, data: { status: 'SUCCEEDED', lastSuccessAt: new Date('2026-10-01T12:00:00Z') } });
    const ok = (await agent.get('/api/dashboard')).json().source;
    expect(ok).toMatchObject({ status: 'CONNECTED' });
    expect(ok.detail).toContain('2026-10-01T12:00:00.000Z');

    await updateSettings({ monitoring: { source: 'fixture' } });
    const fx = (await agent.get('/api/dashboard')).json().source;
    expect(fx.name).toMatch(/Fixture \(dados de TESTE\)/);
    expect(fx.detail).toMatch(/NÃO são ofertas reais/);
  });
});

describe('GET /api/reports/summary', () => {
  it('banco vazio: zeros, listas vazias e métricas de afiliado indisponíveis', async () => {
    const res = await agent.get('/api/reports/summary');
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r).toMatchObject({ period: { days: 30 }, found: 0, approved: 0, published: 0, failed: 0, byCategory: [], recentPriceDrops: [] });
    expect(r.affiliateMetrics).toEqual({ available: false, reason: AFFILIATE_METRICS_REASON });
  });

  it('affiliateMetrics.available=false SEMPRE, sem nenhum número de cliques/vendas/comissões — mesmo com dados no banco', async () => {
    const channel = await seedManualChannel();
    const p = await seedMlProduct();
    const link = await seedLinkFor(p.id);
    const o = await seedOfferFor(p.id, { status: 'PUBLISHED' });
    await pub(o.id, channel.id, link.id, 'SENT', new Date());
    const res = await agent.get('/api/reports/summary?days=90');
    const r = res.json();
    expect(r.published).toBe(1);
    expect(Object.keys(r.affiliateMetrics).sort()).toEqual(['available', 'reason']);
    expect(r.affiliateMetrics.available).toBe(false);
    expect(r.affiliateMetrics.reason).toMatch(/Não há fonte autorizada/);
    expect(res.body).not.toMatch(/clicks|cliques":|commission|comiss[ãa]o":|sales":/i);
  });

  describe('com dados conhecidos', () => {
    async function seed() {
      const alpha = await prisma.category.create({ data: { key: 'alpha', name: 'Alpha', mlCategoryIds: ['MLB1'], enabled: true } });
      const beta = await prisma.category.create({ data: { key: 'beta', name: 'Beta', mlCategoryIds: ['MLB2'], enabled: true } });
      await prisma.category.create({ data: { key: 'gama', name: 'Gama (sem atividade)', mlCategoryIds: ['MLB3'], enabled: true } });
      const channel = await seedManualChannel();
      const a1 = await seedMlProduct({ title: 'A1', categoryId: alpha.id });
      const a2 = await seedMlProduct({ title: 'A2', categoryId: alpha.id });
      const b1 = await seedMlProduct({ title: 'B1', categoryId: beta.id });
      const sem = await seedMlProduct({ title: 'Sem categoria' });
      const links = { a1: await seedLinkFor(a1.id), b1: await seedLinkFor(b1.id) };
      // dentro de 30 dias
      const oa1 = await seedOfferFor(a1.id, { status: 'PUBLISHED', tier: 'EXCELLENT', decidedAt: ago(2 * D), discoveredAt: ago(3 * D) });
      await seedOfferFor(a1.id, { status: 'APPROVED', tier: 'GOOD', decidedAt: ago(1 * D), discoveredAt: ago(2 * D) });
      await seedOfferFor(a2.id, { status: 'REJECTED', tier: 'BELOW', decidedAt: ago(1 * D), discoveredAt: ago(1 * D) });
      const ob1 = await seedOfferFor(b1.id, { status: 'QUEUED', tier: 'EXCEPTIONAL', decidedAt: ago(5 * D), discoveredAt: ago(6 * D) });
      await seedOfferFor(sem.id, { status: 'DISCOVERED', tier: 'GOOD', discoveredAt: ago(1 * D) }); // sem categoria: fora do byCategory, dentro de "found"
      // fora de 30 dias (dentro de 60)
      await seedOfferFor(a1.id, { status: 'APPROVED', tier: 'EXCELLENT', decidedAt: ago(40 * D), discoveredAt: ago(41 * D) });
      // publicações
      await pub(oa1.id, channel.id, links.a1.id, 'SENT', ago(2 * D));
      await pub(ob1.id, channel.id, links.b1.id, 'SENT', ago(40 * D)); // fora da janela de 30d
      await pub(ob1.id, channel.id, links.b1.id, 'FAILED');
      await pub(ob1.id, channel.id, links.b1.id, 'DEAD');
      await pub(ob1.id, channel.id, links.b1.id, 'PENDING');
      return { alpha, beta, a1, b1 };
    }

    it('contagens do período (padrão 30 dias) batem com o banco', async () => {
      await seed();
      const r = (await agent.get('/api/reports/summary')).json();
      expect(r.period.days).toBe(30);
      expect(r.found).toBe(5); // 5 ofertas descobertas nos últimos 30 dias (a de 41 dias fica de fora)
      expect(r.approved).toBe(3); // decididas na janela e em APPROVED/QUEUED/PUBLISHED (a REJECTED e a decidida há 40 dias ficam de fora)
      expect(r.published).toBe(1); // o envio de 40 dias atrás fica de fora
      expect(r.failed).toBe(2); // FAILED + DEAD
    });

    it('período maior inclui o que estava fora; menor exclui', async () => {
      await seed();
      const r60 = (await agent.get('/api/reports/summary?days=60')).json();
      expect(r60).toMatchObject({ found: 6, approved: 4, published: 2 });
      const r4 = (await agent.get('/api/reports/summary?days=4')).json();
      expect(r4).toMatchObject({ found: 4, approved: 2, published: 1 });
      const r1 = (await agent.get('/api/reports/summary?days=1')).json();
      expect(r1.found).toBe(0); // as ofertas mais recentes têm 1 dia exato (discoveredAt = agora-1d, antes do início da janela)
    });

    it('byCategory: por categoria (descobertas, qualificadas = faixa != BELOW, publicadas), maior primeiro, sem categorias sem atividade', async () => {
      const { alpha, beta } = await seed();
      const r = (await agent.get('/api/reports/summary')).json();
      expect(r.byCategory).toEqual([
        { categoryId: alpha.id, name: 'Alpha', found: 3, qualified: 2, published: 1 },
        { categoryId: beta.id, name: 'Beta', found: 1, qualified: 1, published: 0 },
      ]);
      const r60 = (await agent.get('/api/reports/summary?days=60')).json();
      expect(r60.byCategory.map((c: { name: string; found: number; published: number }) => [c.name, c.found, c.published])).toEqual([['Alpha', 4, 1], ['Beta', 1, 1]]);
    });

    it('período: from/to coerentes (to - from = dias)', async () => {
      const r = (await agent.get('/api/reports/summary?days=7')).json();
      expect((Date.parse(r.period.to) - Date.parse(r.period.from)) / D).toBeCloseTo(7, 5);
      expect(r.period.days).toBe(7);
    });
  });

  it('recentPriceDrops: quedas reais entre observações consecutivas do mesmo anúncio, só dentro da janela, ≥ 1%, mais recentes primeiro', async () => {
    const p = await seedMlProduct({ title: 'Fone com queda', externalId: 'MLB1000000001' });
    const q = await seedMlProduct({ title: 'Cafeteira com queda antiga', externalId: 'MLB1000000002' });
    const r = await seedMlProduct({ title: 'Teclado só subiu', externalId: 'MLB1000000003' });
    const row = (productId: string, listingId: string, priceCents: number, ms: number) =>
      prisma.priceHistory.create({ data: { productId, listingId, source: 'ml_api', priceCents, observedAt: ago(ms) } });
    // p: 200 -> 150 (25%) -> 150 (igual) -> 160 (subiu) -> 159,90 (queda de 0,06%: não conta)
    await row(p.id, p.externalId, 20000, 5 * D);
    await row(p.id, p.externalId, 15000, 3 * D);
    await row(p.id, p.externalId, 15000, 2 * D);
    await row(p.id, p.externalId, 16000, 1 * D);
    await row(p.id, p.externalId, 15990, 12 * H);
    // q: a queda de 10% aconteceu há 10 dias (dentro de 30); a observação anterior é de 40 dias (fora da janela, mas serve de base)
    await row(q.id, q.externalId, 10000, 40 * D);
    await row(q.id, q.externalId, 9000, 10 * D);
    // r: só subiu
    await row(r.id, r.externalId, 5000, 4 * D);
    await row(r.id, r.externalId, 6000, 2 * D);
    // queda ANTES da janela de 30 dias não aparece
    const old = await seedMlProduct({ title: 'Queda antiga demais', externalId: 'MLB1000000004' });
    await row(old.id, old.externalId, 9000, 50 * D);
    await row(old.id, old.externalId, 6000, 45 * D);

    const body = (await agent.get('/api/reports/summary')).json();
    expect(body.recentPriceDrops).toHaveLength(2);
    expect(body.recentPriceDrops[0]).toMatchObject({ productId: p.id, title: 'Fone com queda', fromCents: 20000, toCents: 15000, pct: 25 });
    expect(body.recentPriceDrops[1]).toMatchObject({ productId: q.id, title: 'Cafeteira com queda antiga', fromCents: 10000, toCents: 9000, pct: 10 });
    expect(Date.parse(body.recentPriceDrops[0].at)).toBeGreaterThan(Date.parse(body.recentPriceDrops[1].at));
    expect(Object.keys(body.recentPriceDrops[0]).sort()).toEqual(['at', 'fromCents', 'pct', 'productId', 'title', 'toCents']);

    const week = (await agent.get('/api/reports/summary?days=7')).json();
    expect(week.recentPriceDrops.map((d: { productId: string }) => d.productId)).toEqual([p.id]);
  });

  it('recentPriceDrops: no máximo 20 itens', async () => {
    for (let i = 0; i < 25; i++) {
      const p = await seedMlProduct({ externalId: `MLB${1000001000 + i}` });
      await prisma.priceHistory.create({ data: { productId: p.id, listingId: p.externalId, source: 'ml_api', priceCents: 10000, observedAt: ago(3 * D) } });
      await prisma.priceHistory.create({ data: { productId: p.id, listingId: p.externalId, source: 'ml_api', priceCents: 8000, observedAt: ago(2 * D + i * 1000) } });
    }
    expect((await agent.get('/api/reports/summary')).json().recentPriceDrops).toHaveLength(20);
  });

  it('days inválido => 400; limites 1 e 365 aceitos; vazio = padrão 30', async () => {
    for (const q of ['days=0', 'days=366', 'days=-3', 'days=abc', 'days=1.5']) {
      const res = await agent.get(`/api/reports/summary?${q}`);
      expect(res.statusCode, q).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect((await agent.get('/api/reports/summary?days=1')).json().period.days).toBe(1);
    expect((await agent.get('/api/reports/summary?days=365')).json().period.days).toBe(365);
    expect((await agent.get('/api/reports/summary?days=')).json().period.days).toBe(30);
  });
});
