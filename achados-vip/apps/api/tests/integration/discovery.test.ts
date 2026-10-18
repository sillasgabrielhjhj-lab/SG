import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixtureSource } from '../../src/adapters/sources/fixture.js';
import { SourceAuthError, SourceRateLimitError, type NormalizedListing } from '../../src/domain/types.js';
import { prisma } from '../../src/lib/db.js';
import { runDiscovery } from '../../src/services/discovery.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { at, mkListing, ScriptedSource, seedCategory } from '../helpers/discovery-fixtures.js';

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});

/** Roda 3 coletas a preço fixo, espaçadas de 3h (acima da janela de dedupe), para formar histórico. */
async function buildHistory(source: ScriptedSource, price = 20000): Promise<void> {
  source.calls = [];
  for (const h of [0, 3, 6]) {
    current = [mkListing({ priceCents: price })];
    await runDiscovery({ source, now: at(h) });
  }
}
let current: NormalizedListing[] = [];
const scripted = () => new ScriptedSource(() => current);

describe('descoberta: classificação e criação de ofertas', () => {
  it('produto novo sem histórico não vira oferta (sem desconto verificado a faixa fica BELOW)', async () => {
    await seedCategory();
    current = [mkListing()];
    const stats = await runDiscovery({ source: scripted(), now: at(0) });
    expect(stats).toMatchObject({ found: 1, upserted: 1, scored: 1, approved: 0, rejected: 0, suspended: 0, skipped: 0, created: 0 });
    expect(await prisma.offer.count()).toBe(0);
    expect(await prisma.product.count()).toBe(1);
    expect(await prisma.priceHistory.count()).toBe(1);
  });

  it('queda real com histórico verificado cria oferta pontuada, com desconto VERIFICADO e referência = maior preço observado', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    const stats = await runDiscovery({ source: src, now: at(9) });
    expect(stats.created).toBe(1);

    const offer = await prisma.offer.findFirstOrThrow({ include: { product: true } });
    expect(offer).toMatchObject({ priceCents: 14000, originalPriceCents: 20000, discountPct: 30, savingsCents: 6000, discountVerified: true, status: 'DISCOVERED' });
    expect(['EXCELLENT', 'EXCEPTIONAL']).toContain(offer.tier);
    expect(offer.score).toBeGreaterThanOrEqual(75);
    expect(offer.scoreBreakdown).toBeTruthy();
    expect(offer.decidedBy).toBeNull();
    expect(offer.expiresAt).not.toBeNull();
    expect(offer.priceHistoryId).toBeTruthy();
    expect(offer.product.familyKey).not.toBe('');
  });

  it('autoPublish ligado e score >= mínimo aprova automaticamente; desligado deixa DISCOVERED', async () => {
    await seedCategory();
    await updateSettings({ publishing: { autoPublish: true } });
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    const stats = await runDiscovery({ source: src, now: at(9) });
    expect(stats.approved).toBe(1);
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer).toMatchObject({ status: 'APPROVED', decidedBy: 'auto' });
    expect(offer.decisionNote).toMatch(/automaticamente/);
  });

  it('a pontuação mínima da categoria sobrescreve a global na auto-aprovação', async () => {
    await seedCategory({ minScore: 99 });
    await updateSettings({ publishing: { autoPublish: true } });
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('DISCOVERED');
  });

  it('faixa BELOW vira REJECTED com motivo registrado', async () => {
    await seedCategory();
    const src = scripted();
    // 2 observações apenas: sem referência verificada => score baixo, mas a queda de 10% cria o registro
    for (const [h, price] of [[0, 20000], [3, 18000]] as const) {
      current = [mkListing({ priceCents: price, seller: null, quality: null, soldQuantity: null, availableQuantity: null })];
      await runDiscovery({ source: src, now: at(h) });
    }
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer).toMatchObject({ status: 'REJECTED', tier: 'BELOW', decidedBy: 'auto' });
    expect(offer.decisionNote).toMatch(/abaixo do mínimo/);
  });

  it('desconto SÓ ANUNCIADO nunca é exibido como verificado (sem referência no histórico)', async () => {
    await seedCategory();
    const src = scripted();
    for (const [h, price] of [[0, 20000], [3, 18000]] as const) {
      current = [mkListing({ priceCents: price, advertisedOriginalPriceCents: 40000 })]; // "de R$ 400" anunciado
      await runDiscovery({ source: src, now: at(h) });
    }
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer.discountVerified).toBe(false);
    expect(offer.originalPriceCents).toBeNull();
    expect(offer.discountPct).toBeNull();
    expect(offer.savingsCents).toBeNull();
    const breakdown = offer.scoreBreakdown as Record<string, { points: number; note: string }>;
    expect(breakdown.discount?.points).toBe(0);
    expect(breakdown.discount?.note).toMatch(/^sem dado: desconto anunciado/);
  });

  it('desconto anunciado enorme (>80%) sem histórico é dado inconsistente: suspende o produto', async () => {
    await seedCategory();
    current = [mkListing({ priceCents: 5000, advertisedOriginalPriceCents: 90000 })];
    const stats = await runDiscovery({ source: scripted(), now: at(0) });
    expect(stats.suspended).toBe(1);
    expect(await prisma.offer.count()).toBe(0);
    expect(await prisma.priceHistory.count()).toBe(0);
  });
});

describe('descoberta: duplicidade e republicação', () => {
  it('repetir a coleta com os mesmos dados é idempotente (sem novas ofertas nem observações)', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    const obs = await prisma.priceHistory.count();
    for (const h of [9.5, 10]) {
      const stats = await runDiscovery({ source: src, now: at(h) });
      expect(stats.created).toBe(0);
    }
    expect(await prisma.offer.count()).toBe(1);
    expect(await prisma.priceHistory.count()).toBe(obs); // idêntica < 2h: não grava
    expect((await prisma.product.findFirstOrThrow()).lastSeenAt.getTime()).toBe(at(10).getTime());
  });

  it('queda menor que minPriceDropPct não cria oferta', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 19700 })]; // -1,5% (< 3%)
    expect((await runDiscovery({ source: src, now: at(9) })).created).toBe(0);
    expect(await prisma.offer.count()).toBe(0);
  });

  it('nova queda substitui a oferta aberta anterior (que fica EXPIRED) e mantém só uma ativa', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    current = [mkListing({ priceCents: 12000 })];
    const stats = await runDiscovery({ source: src, now: at(12) });
    expect(stats.created).toBe(1);
    const offers = await prisma.offer.findMany({ orderBy: { priceCents: 'asc' } });
    expect(offers.map((o) => [o.priceCents, o.status])).toEqual([[12000, 'DISCOVERED'], [14000, 'EXPIRED']]);
    expect(offers[1]!.decisionNote).toMatch(/Substituída/);
  });

  it('oferta já publicada: o preço subir e voltar ao mesmo valor NÃO gera nova oferta (republicação bloqueada)', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    await prisma.offer.updateMany({ data: { status: 'PUBLISHED' } });
    current = [mkListing({ priceCents: 17000 })];
    await runDiscovery({ source: src, now: at(12) });
    current = [mkListing({ priceCents: 14000 })];
    const stats = await runDiscovery({ source: src, now: at(15) });
    expect(stats.created).toBe(0);
    expect(await prisma.offer.count()).toBe(1);
  });

  it('família do catálogo: outro anúncio do mesmo produto com preço maior ou igual não duplica a oferta', async () => {
    await seedCategory();
    const src = scripted();
    const a = (price: number) => mkListing({ externalId: 'MLB1000000001', catalogProductId: 'MLB555', priceCents: price });
    const b = (price: number) => mkListing({ externalId: 'MLB1000000002', catalogProductId: 'MLB555', priceCents: price });
    for (const h of [0, 3, 6]) {
      current = [a(20000), b(20000)];
      await runDiscovery({ source: src, now: at(h) });
    }
    current = [a(14000), b(14000)];
    const stats = await runDiscovery({ source: src, now: at(9) });
    expect(stats.created).toBe(1); // só um anúncio da família vira oferta
    expect(await prisma.offer.count()).toBe(1);
  });

  it('rejeição MANUAL é respeitada para o mesmo preço; rejeição automática não bloqueia oferta nova', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    await prisma.offer.updateMany({ data: { status: 'REJECTED', decidedBy: 'user-1' } });
    current = [mkListing({ priceCents: 17000 })];
    await runDiscovery({ source: src, now: at(12) });
    current = [mkListing({ priceCents: 14000 })];
    expect((await runDiscovery({ source: src, now: at(15) })).created).toBe(0);
  });
});

describe('descoberta: dados inconsistentes, estoque e validação', () => {
  it('queda de 90% sem histórico que a confirme suspende o produto por 24h (sem gravar o preço suspeito)', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    const before = await prisma.priceHistory.count();

    current = [mkListing({ priceCents: 1400 })]; // -90%
    const stats = await runDiscovery({ source: src, now: at(12) });
    expect(stats.suspended).toBe(1);
    const product = await prisma.product.findFirstOrThrow();
    expect(product.status).toBe('SUSPENDED');
    expect(product.suspendReason).toMatch(/^dados inconsistentes/);
    expect(product.suspendedUntil!.getTime()).toBe(at(12 + 24).getTime());
    expect(await prisma.priceHistory.count()).toBe(before);
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('SUSPENDED'); // oferta aberta também suspensa

    // dentro das 24h: ignorado
    const again = await runDiscovery({ source: src, now: at(20) });
    expect(again).toMatchObject({ skipped: 1, suspended: 0, upserted: 0 });

    // depois das 24h com preço normal: volta a ser processado
    current = [mkListing({ priceCents: 14000 })];
    const back = await runDiscovery({ source: src, now: at(40) });
    expect(back.upserted).toBe(1);
    expect((await prisma.product.findFirstOrThrow()).status).toBe('ACTIVE');
  });

  it('queda de 90% já visitada no histórico (preço oscilante) não é tratada como inconsistente', async () => {
    await seedCategory();
    const src = scripted();
    for (const [h, price] of [[0, 20000], [3, 2000], [6, 20000]] as const) {
      current = [mkListing({ priceCents: price })];
      await runDiscovery({ source: src, now: at(h) });
    }
    current = [mkListing({ priceCents: 2000 })];
    const stats = await runDiscovery({ source: src, now: at(9) });
    expect(stats.suspended).toBe(0);
  });

  it('item sem estoque: não vira oferta, produto fica UNAVAILABLE e ofertas abertas expiram', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    current = [mkListing({ priceCents: 14000, availableQuantity: 0 })];
    const stats = await runDiscovery({ source: src, now: at(12) });
    expect(stats.skipped).toBe(1);
    expect((await prisma.product.findFirstOrThrow()).status).toBe('UNAVAILABLE');
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('EXPIRED');
  });

  it('preço que sobe expira a oferta aberta de preço menor', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    current = [mkListing({ priceCents: 16000 })];
    await runDiscovery({ source: src, now: at(12) });
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('EXPIRED');
  });

  it('ofertas abertas passam a EXPIRED após o prazo (24h)', async () => {
    await seedCategory();
    const src = scripted();
    await buildHistory(src);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: src, now: at(9) });
    current = [];
    await runDiscovery({ source: src, now: at(9 + 25) });
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('EXPIRED');
  });

  it('listagens inválidas (preço 0, permalink http, sem título) são ignoradas sem derrubar as demais', async () => {
    await seedCategory();
    current = [
      mkListing({ externalId: 'MLB1', priceCents: 0 }),
      mkListing({ externalId: 'MLB2', permalink: 'http://produto.mercadolivre.com.br/MLB-2' }),
      mkListing({ externalId: 'MLB3', title: '  ' }),
      mkListing({ externalId: 'MLB4', title: 'Cafeteira Elétrica Arno 15 Xícaras' }),
    ];
    const stats = await runDiscovery({ source: scripted(), now: at(0) });
    expect(stats).toMatchObject({ found: 4, upserted: 1, skipped: 3 });
    expect(await prisma.product.count()).toBe(1);
  });
});

describe('descoberta: categorias, falhas e job', () => {
  it('erro em uma categoria não impede as outras; o job registra o erro e as estatísticas', async () => {
    await seedCategory({ key: 'a', name: 'Cat A', mlCategoryIds: ['MLB1'], sortOrder: 1 });
    await seedCategory({ key: 'b', name: 'Cat B', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    await seedCategory({ key: 'c', name: 'Cat C desligada', mlCategoryIds: ['MLB3'], enabled: false, sortOrder: 3 });
    const src = new ScriptedSource((ctx) => {
      if (ctx.mlCategoryIds.includes('MLB1')) throw new Error('falha simulada na categoria A');
      return [mkListing({ externalId: 'MLB200', title: 'Cafeteira Elétrica Arno 15 Xícaras' })];
    });
    const stats = await runDiscovery({ source: src, now: at(0) });
    expect(stats).toMatchObject({ categories: 2, failedCategories: 1, found: 1, upserted: 1 });
    expect(stats.errors[0]).toMatch(/Cat A: falha simulada/);
    expect(src.calls).toHaveLength(2);

    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } });
    expect(job).toMatchObject({ status: 'SUCCEEDED', runCount: 1, queue: 'discovery' });
    expect(job.lastError).toMatch(/Cat A/);
    expect(job.heartbeatAt).not.toBeNull();
    expect(job.lastDurationMs).not.toBeNull();
    expect((job.lastStats as { found: number }).found).toBe(1);
    expect(await prisma.systemLog.count({ where: { scope: 'discovery', level: 'ERROR' } })).toBeGreaterThan(0);
  });

  it('todas as categorias falhando marca o job como FAILED', async () => {
    await seedCategory();
    const src = new ScriptedSource(() => {
      throw new Error('fonte fora do ar');
    });
    await runDiscovery({ source: src, now: at(0) });
    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } });
    expect(job).toMatchObject({ status: 'FAILED', failCount: 1 });
    expect(job.lastSuccessAt).toBeNull();
  });

  it('SourceAuthError interrompe a rodada, marca a integração AUTH_REQUIRED e notifica (sem duplicar o alerta)', async () => {
    await seedCategory({ key: 'a', name: 'Cat A', mlCategoryIds: ['MLB1'], sortOrder: 1 });
    await seedCategory({ key: 'b', name: 'Cat B', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    await prisma.integrationCredential.create({ data: { provider: 'mercadolivre', name: 'ML', encrypted: 'x', status: 'CONNECTED' } });
    const src = new ScriptedSource(() => {
      throw new SourceAuthError('Mercado Livre negou o acesso (HTTP 403).');
    }, 'mercadolivre');
    await runDiscovery({ source: src, now: at(0) });
    await runDiscovery({ source: src, now: at(1) });
    expect(src.calls).toHaveLength(2); // 1 chamada por rodada: a 2ª categoria não foi tentada
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('AUTH_REQUIRED');
    const notes = await prisma.notification.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: 'integration_auth_required', level: 'ERROR' });
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).status).toBe('FAILED');
  });

  it('uma coleta bem-sucedida volta a integração para CONNECTED e resolve o alerta', async () => {
    await seedCategory();
    await prisma.integrationCredential.create({ data: { provider: 'mercadolivre', name: 'ML', encrypted: 'x', status: 'AUTH_REQUIRED' } });
    await prisma.notification.create({ data: { type: 'integration_auth_required', title: 'x', dedupeKey: 'integration_auth_required:mercadolivre' } });
    current = [mkListing()];
    await runDiscovery({ source: new ScriptedSource(() => current, 'mercadolivre'), now: at(0) });
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('CONNECTED');
    expect((await prisma.notification.findFirstOrThrow()).readAt).not.toBeNull();
  });

  it('SourceRateLimitError interrompe a rodada sem tentar as demais categorias', async () => {
    await seedCategory({ key: 'a', name: 'Cat A', mlCategoryIds: ['MLB1'], sortOrder: 1 });
    await seedCategory({ key: 'b', name: 'Cat B', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    const src = new ScriptedSource(() => {
      throw new SourceRateLimitError('429', 5000);
    });
    const stats = await runDiscovery({ source: src, now: at(0) });
    expect(src.calls).toHaveLength(1);
    expect(stats.failedCategories).toBe(1);
  });

  it('sem categorias habilitadas: conclui sem erro de execução e sinaliza no job', async () => {
    const src = scripted();
    const stats = await runDiscovery({ source: src, now: at(0) });
    expect(stats.categories).toBe(0);
    expect(src.calls).toHaveLength(0);
    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } });
    expect(job.status).toBe('SUCCEEDED');
    expect(job.lastError).toMatch(/Nenhuma categoria habilitada/);
  });

  it('respeita monitoring.maxItemsPerCategory', async () => {
    await seedCategory();
    await updateSettings({ monitoring: { maxItemsPerCategory: 2 } });
    current = Array.from({ length: 5 }, (_, i) => mkListing({ externalId: `MLB10${i}`, title: `Produto de teste numero ${i} exclusivo` }));
    const src = scripted();
    const stats = await runDiscovery({ source: src, now: at(0) });
    expect(src.calls[0]!.limit).toBe(2);
    expect(stats.found).toBe(2);
  });
});

describe('descoberta com a fonte FIXTURE (dados de TESTE)', () => {
  it('gera produtos marcados como fixture e usa source=fixture no histórico', async () => {
    await seedCategory({ mlCategoryIds: ['MLB1055'] });
    await updateSettings({ monitoring: { source: 'fixture', maxItemsPerCategory: 3 } });
    const fixture = new FixtureSource({ now: () => at(0) });
    const stats = await runDiscovery({ source: fixture, now: at(0) });
    expect(stats.upserted).toBe(3);
    const products = await prisma.product.findMany();
    expect(products.every((p) => p.source === 'fixture' && p.title.startsWith('[FIXTURE]'))).toBe(true);
    expect((await prisma.priceHistory.findMany()).every((h) => h.source === 'fixture')).toBe(true);
  });

  it('cenário de queda de preço: depois de formar histórico, a fixture gera oferta com desconto verificado', async () => {
    await seedCategory({ mlCategoryIds: ['MLB1055'] });
    await updateSettings({ monitoring: { source: 'fixture', maxItemsPerCategory: 1 } });
    const fixture = new FixtureSource({ now: () => at(0) });
    for (const h of [0, 3, 6]) await runDiscovery({ source: fixture, now: at(h) });
    const product = await prisma.product.findFirstOrThrow();
    fixture.priceDrop(product.externalId, 40);
    await runDiscovery({ source: fixture, now: at(9) });
    const offer = await prisma.offer.findFirst();
    expect(offer).not.toBeNull();
    expect(offer!.discountVerified).toBe(true);
    expect(offer!.discountPct).toBe(40);
  });
});
