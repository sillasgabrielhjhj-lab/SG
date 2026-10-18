import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings.js';
import { prisma } from '../../src/lib/db.js';
import { DEFAULT_CATEGORIES, MANUAL_QUEUE_CHANNEL_NAME, runSeed } from '../../prisma/seed.js';
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

describe('seed', () => {
  it('cria as 11 categorias iniciais desabilitadas, configurações padrão e o canal da fila manual', async () => {
    await runSeed();
    const cats = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(cats.map((c) => c.name)).toEqual([
      'Smartphones e acessórios',
      'Informática e notebooks',
      'Eletrodomésticos',
      'Casa e cozinha',
      'Eletrônicos',
      'Games e consoles',
      'Beleza e cuidados pessoais',
      'Moda e calçados',
      'Áudio e fones de ouvido',
      'Ferramentas domésticas',
      'Produtos populares em alta',
    ]);
    expect(cats.every((c) => c.enabled === false)).toBe(true);
    expect(cats.find((c) => c.key === 'smartphones')?.mlCategoryIds).toEqual(['MLB1055']);
    expect(cats.find((c) => c.key === 'ferramentas')?.mlCategoryIds).toEqual(['MLB263532']);
    // sem ID confirmado => lista vazia (+ termos de busca), nunca um palpite
    expect(cats.find((c) => c.key === 'audio-fones')?.mlCategoryIds).toEqual([]);
    expect(cats.find((c) => c.key === 'audio-fones')?.searchTerms.length).toBeGreaterThan(0);
    for (const c of DEFAULT_CATEGORIES) for (const id of c.mlCategoryIds) expect(id).toMatch(/^MLB\d+$/);

    const settings = await prisma.automationSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.data).toEqual(defaultSettings());

    const channels = await prisma.publishingChannel.findMany();
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ type: 'WHATSAPP_MANUAL_QUEUE', name: MANUAL_QUEUE_CHANNEL_NAME, enabled: true });
    expect(MANUAL_QUEUE_CHANNEL_NAME).toBe('Fila manual – ACHADOS VIP');
  });

  it('é idempotente e NÃO sobrescreve edições do administrador', async () => {
    await runSeed();
    await prisma.category.update({ where: { key: 'smartphones' }, data: { enabled: true, relevance: 99, mlCategoryIds: ['MLB1055', 'MLB9999'] } });
    await prisma.publishingChannel.updateMany({ data: { enabled: false } });
    await runSeed();
    expect(await prisma.category.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await prisma.publishingChannel.count()).toBe(1);
    const c = await prisma.category.findUniqueOrThrow({ where: { key: 'smartphones' } });
    expect(c).toMatchObject({ enabled: true, relevance: 99, mlCategoryIds: ['MLB1055', 'MLB9999'] });
    expect((await prisma.publishingChannel.findFirstOrThrow()).enabled).toBe(false);
  });
});

describe('categorias (API)', () => {
  it('lista com o formato CategoryDTO', async () => {
    await runSeed();
    const res = await agent.get('/api/categories');
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list).toHaveLength(11);
    expect(list[0]).toEqual({
      id: expect.any(String),
      key: 'smartphones',
      name: 'Smartphones e acessórios',
      mlCategoryIds: ['MLB1055'],
      searchTerms: expect.any(Array),
      enabled: false,
      relevance: 80,
      dailyLimit: null,
      minScore: null,
      sortOrder: 0,
    });
  });

  it('PATCH altera campos, normaliza listas e audita before/after', async () => {
    await runSeed();
    const cat = await prisma.category.findUniqueOrThrow({ where: { key: 'games' } });
    const res = await agent.patch(`/api/categories/${cat.id}`, {
      enabled: true,
      relevance: 90,
      dailyLimit: 3,
      minScore: 80,
      mlCategoryIds: ['mlb1144', 'MLB1144', ' MLB1246 '],
      searchTerms: ['  ps5  ', 'ps5', 'nintendo switch'],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      enabled: true,
      relevance: 90,
      dailyLimit: 3,
      minScore: 80,
      mlCategoryIds: ['MLB1144', 'MLB1246'],
      searchTerms: ['ps5', 'nintendo switch'],
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'category.update' } });
    expect((log.before as any).enabled).toBe(false);
    expect((log.after as any).enabled).toBe(true);
    expect(log.userId).toBe(agent.user.id);

    // null remove limites opcionais
    const cleared = await agent.patch(`/api/categories/${cat.id}`, { dailyLimit: null, minScore: null });
    expect(cleared.json()).toMatchObject({ dailyLimit: null, minScore: null });
  });

  it('não permite habilitar categoria sem ID do ML nem termos de busca (422)', async () => {
    await runSeed();
    const populares = await prisma.category.findUniqueOrThrow({ where: { key: 'populares' } });
    const res = await agent.patch(`/api/categories/${populares.id}`, { enabled: true });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('CATEGORY_WITHOUT_SOURCE');
    expect((await prisma.category.findUniqueOrThrow({ where: { id: populares.id } })).enabled).toBe(false);
    // com termos, pode
    const ok = await agent.patch(`/api/categories/${populares.id}`, { enabled: true, searchTerms: ['mais vendidos'] });
    expect(ok.statusCode).toBe(200);
    // e esvaziar as fontes de uma categoria habilitada também é recusado
    expect((await agent.patch(`/api/categories/${populares.id}`, { searchTerms: [] })).statusCode).toBe(422);
  });

  it.each([
    ['campo desconhecido', { nome: 'x' }],
    ['relevância fora do intervalo', { relevance: 101 }],
    ['ID de categoria inválido', { mlCategoryIds: ['1055'] }],
    ['termo curto demais', { searchTerms: ['a'] }],
    ['corpo vazio', {}],
    ['tipo errado', { enabled: 'sim' }],
  ])('PATCH inválido (%s) => 400', async (_n, body) => {
    await runSeed();
    const cat = await prisma.category.findFirstOrThrow();
    const res = await agent.patch(`/api/categories/${cat.id}`, body);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('categoria inexistente => 404', async () => {
    expect((await agent.patch('/api/categories/nao-existe', { enabled: false })).statusCode).toBe(404);
  });
});
