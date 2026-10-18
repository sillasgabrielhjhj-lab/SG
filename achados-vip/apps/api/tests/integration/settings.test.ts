import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings.js';
import { prisma } from '../../src/lib/db.js';
import { clearSettingsCache, getSettings, updateSettings } from '../../src/services/settings.js';
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

describe('GET /api/settings', () => {
  it('devolve os padrões seguros na primeira leitura e cria a linha singleton', async () => {
    expect(await prisma.automationSettings.count()).toBe(0);
    const res = await agent.get('/api/settings');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(defaultSettings());
    expect(res.json().publishing.autoPublish).toBe(false);
    expect(res.json().monitoring.enabled).toBe(false);
    expect(res.json().affiliate.requireValidatedLink).toBe(true);
    expect(await prisma.automationSettings.count()).toBe(1);
  });
});

describe('PUT /api/settings', () => {
  it('aplica patch parcial e profundo, preservando o restante, e persiste', async () => {
    const res = await agent.put('/api/settings', {
      publishing: { autoPublish: true, maxPerHour: 3 },
      scoring: { weights: { discount: 40 }, thresholds: { good: 55 } },
    });
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.publishing).toMatchObject({ autoPublish: true, maxPerHour: 3, maxPerDay: 12, minIntervalMinutes: 30 });
    expect(s.publishing.quietHours).toMatchObject({ enabled: true, start: '00:00', end: '07:00', timezone: 'America/Sao_Paulo' });
    expect(s.scoring.weights).toMatchObject({ discount: 40, savings: 10, historical: 20 });
    expect(s.scoring.thresholds).toEqual({ exceptional: 90, excellent: 75, good: 55 });

    // GET imediato já enxerga (cache invalidado) e o banco guarda o mesmo
    expect((await agent.get('/api/settings')).json()).toEqual(s);
    const row = await prisma.automationSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.data).toEqual(s);
    expect(row.updatedBy).toBe(agent.user.id);
    expect(await getSettings()).toEqual(s);
  });

  it('pesos de score são editáveis', async () => {
    const res = await agent.put('/api/settings', { scoring: { weights: { discount: 0, historical: 50, seller: 15 } } });
    expect(res.statusCode).toBe(200);
    expect(res.json().scoring.weights).toMatchObject({ discount: 0, historical: 50, seller: 15, savings: 10 });
  });

  it('grava auditoria com before/after, usuário e IP', async () => {
    await agent.put('/api/settings', { publishing: { maxPerDay: 20 } });
    const logs = await prisma.auditLog.findMany({ where: { action: 'settings.update' } });
    expect(logs).toHaveLength(1);
    const log = logs[0]!;
    expect(log).toMatchObject({ userId: agent.user.id, entity: 'AutomationSettings', entityId: '1' });
    expect((log.before as any).publishing.maxPerDay).toBe(12);
    expect((log.after as any).publishing.maxPerDay).toBe(20);
    expect(log.ip).toBeTruthy();

    const audit = await agent.get('/api/audit');
    expect(audit.statusCode).toBe(200);
    expect(audit.json().items[0]).toMatchObject({ action: 'settings.update', userEmail: agent.user.email });
  });

  it('patch sem mudança real não grava nem audita', async () => {
    await agent.put('/api/settings', { publishing: { maxPerDay: 20 } });
    await agent.put('/api/settings', { publishing: { maxPerDay: 20 } });
    await agent.put('/api/settings', {});
    expect(await prisma.auditLog.count({ where: { action: 'settings.update' } })).toBe(1);
  });

  it('normaliza domínios permitidos (minúsculas, sem duplicatas)', async () => {
    const res = await agent.put('/api/settings', { affiliate: { allowedHosts: ['Meli.la', ' meli.la ', 'WWW.MercadoLivre.com.br'] } });
    expect(res.statusCode).toBe(200);
    expect(res.json().affiliate.allowedHosts).toEqual(['meli.la', 'www.mercadolivre.com.br']);
  });

  const invalid: [string, unknown, string][] = [
    ['campo desconhecido na raiz', { naoExiste: 1 }, 'naoExiste'],
    ['campo desconhecido aninhado', { publishing: { quietHours: { fuso: 'x' } } }, 'publishing.quietHours.fuso'],
    ['tipo errado', { publishing: { maxPerHour: 'muitos' } }, 'publishing.maxPerHour'],
    ['inteiro fora do intervalo', { scoring: { minScoreToPublish: 150 } }, 'scoring.minScoreToPublish'],
    ['limiares fora de ordem', { scoring: { thresholds: { exceptional: 70, excellent: 80 } } }, 'scoring.thresholds'],
    ['limiares iguais', { scoring: { thresholds: { good: 75 } } }, 'scoring.thresholds'],
    ['todos os pesos zerados', { scoring: { weights: { discount: 0, savings: 0, historical: 0, seller: 0, availability: 0, demand: 0, category: 0, recency: 0, listingQuality: 0 } } }, 'scoring.weights'],
    ['peso negativo', { scoring: { weights: { discount: -1 } } }, 'scoring.weights.discount'],
    ['fuso horário inválido', { publishing: { quietHours: { timezone: 'Marte/Olympus' } } }, 'publishing.quietHours.timezone'],
    ['horário inválido', { publishing: { quietHours: { start: '25:99' } } }, 'publishing.quietHours.start'],
    ['silêncio com início = fim', { publishing: { quietHours: { enabled: true, start: '08:00', end: '08:00' } } }, 'publishing.quietHours'],
    ['link validado não é opcional', { affiliate: { requireValidatedLink: false } }, 'affiliate.requireValidatedLink'],
    ['domínio inválido', { affiliate: { allowedHosts: ['http://evil.com/x'] } }, 'affiliate.allowedHosts.0'],
    ['IP como domínio permitido', { affiliate: { allowedHosts: ['169.254.169.254'] } }, 'affiliate.allowedHosts.0'],
    ['lista de domínios vazia', { affiliate: { allowedHosts: [] } }, 'affiliate.allowedHosts'],
    ['fonte desconhecida', { monitoring: { source: 'scraping' } }, 'monitoring.source'],
  ];
  it.each(invalid)('recusa: %s (400) sem gravar nada', async (_name, patch, path) => {
    const before = await getSettings();
    const res = await agent.put('/api/settings', patch);
    expect(res.statusCode).toBe(400);
    const err = res.json().error;
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details.map((d: any) => d.path)).toContain(path);
    clearSettingsCache();
    expect(await getSettings()).toEqual(before);
    expect(await prisma.auditLog.count({ where: { action: 'settings.update' } })).toBe(0);
  });

  it.each([[[1, 2]], ['texto'], [null], [42]])('corpo que não é objeto (%j) => 400', async (body) => {
    const res = await app.inject({ method: 'PUT', url: '/api/settings', headers: agent.headers({ 'content-type': 'application/json' }), payload: JSON.stringify(body) });
    expect(res.statusCode).toBe(400);
  });

  it('proteção contra prototype pollution no patch', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: agent.headers({ 'content-type': 'application/json' }),
      payload: '{"__proto__":{"polluted":true},"publishing":{"constructor":{"prototype":{"x":1}}}}',
    });
    expect(res.statusCode).toBe(400);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('dois PUTs simultâneos em campos diferentes não se sobrescrevem', async () => {
    const [a, b] = await Promise.all([
      agent.put('/api/settings', { publishing: { maxPerHour: 5 } }),
      agent.put('/api/settings', { retention: { logDays: 90 } }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const s = await agent.get('/api/settings');
    expect(s.json().publishing.maxPerHour).toBe(5);
    expect(s.json().retention.logDays).toBe(90);
  });
});

describe('serviço de configurações', () => {
  it('cache de ~5s: leitura repetida não vai ao banco; updateSettings invalida', async () => {
    const first = await getSettings();
    // altera direto no banco, sem passar pelo serviço
    await prisma.automationSettings.update({ where: { id: 1 }, data: { data: { ...first, retention: { ...first.retention, logDays: 77 } } } });
    expect((await getSettings()).retention.logDays).toBe(first.retention.logDays); // ainda em cache
    clearSettingsCache();
    expect((await getSettings()).retention.logDays).toBe(77);
    await updateSettings({ retention: { logDays: 10 } });
    expect((await getSettings()).retention.logDays).toBe(10); // invalidado pela atualização
  });

  it('cópias independentes: alterar o retorno não corrompe o cache', async () => {
    const a = await getSettings();
    a.publishing.autoPublish = true;
    expect((await getSettings()).publishing.autoPublish).toBe(false);
  });

  it('dado salvo corrompido volta aos padrões seguros (autoPublish=false)', async () => {
    await getSettings();
    await prisma.automationSettings.update({ where: { id: 1 }, data: { data: { publishing: { autoPublish: 'sim', maxPerHour: -4 } } } });
    clearSettingsCache();
    expect(await getSettings()).toEqual(defaultSettings());
  });
});
