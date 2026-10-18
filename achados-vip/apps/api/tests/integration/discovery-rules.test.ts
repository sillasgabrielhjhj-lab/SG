/**
 * Descoberta (runDiscovery) — regras complementares ao discovery.test.ts:
 * referência verificada (quantidade/janela do histórico), queda de preço x oferta nova, preço igual, expiração,
 * suspensão, categorias, isolamento de falhas e idempotência (inclusive execuções concorrentes).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { NormalizedListing } from '../../src/domain/types.js';
import { prisma } from '../../src/lib/db.js';
import { runDiscovery } from '../../src/services/discovery.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { at, hours, mkListing, ScriptedSource, seedCategory, T0 } from '../helpers/discovery-fixtures.js';

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});

let current: NormalizedListing[] = [];
const src = () => new ScriptedSource(() => current);
const run = (source: ScriptedSource, h: number) => runDiscovery({ source, now: at(h) });
/** Rodadas `[hora, preço]` do mesmo anúncio. */
async function runPrices(source: ScriptedSource, steps: readonly (readonly [number, number])[], over: Partial<NormalizedListing> = {}): Promise<void> {
  for (const [h, price] of steps) {
    current = [mkListing({ priceCents: price, ...over })];
    await run(source, h);
  }
}
const daysAfterT0 = (d: number) => new Date(T0.getTime() + d * 24 * hours(1));

describe('descoberta: referência VERIFICADA só com histórico suficiente', () => {
  it('com menos observações que o mínimo (3) a queda NÃO vira desconto verificado nem De/Por', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 14000]]); // só 2 observações anteriores
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer).toMatchObject({ discountVerified: false, originalPriceCents: null, discountPct: null, savingsCents: null });
    const breakdown = offer.scoreBreakdown as Record<string, { points: number; note: string }>;
    expect(breakdown.discount?.points).toBe(0);
    expect(breakdown.discount?.note).toMatch(/^sem dado/);
  });

  it('com o mínimo de observações a referência é o MAIOR preço do histórico próprio na janela (não o último)', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 25000], [6, 20000], [9, 15000]]);
    const offer = await prisma.offer.findFirstOrThrow({ where: { priceCents: 15000 } }); // (a queda 25000 -> 20000 também gerou um registro)
    expect(offer).toMatchObject({ priceCents: 15000, originalPriceCents: 25000, discountPct: 40, savingsCents: 10000, discountVerified: true });
  });

  it('o mínimo é configurável (minHistoryObservations): com 5, três observações não bastam e seis sim', async () => {
    await seedCategory();
    await updateSettings({ scoring: { minHistoryObservations: 5 } });
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]]);
    expect((await prisma.offer.findFirst())?.discountVerified ?? false).toBe(false);

    await resetDb();
    await seedCategory();
    await updateSettings({ scoring: { minHistoryObservations: 5 } });
    const s2 = src();
    await runPrices(s2, [[0, 20000], [3, 20000], [6, 20000], [9, 20000], [12, 20000], [15, 14000]]);
    expect(await prisma.offer.findFirstOrThrow()).toMatchObject({ discountVerified: true, originalPriceCents: 20000, discountPct: 30 });
  });

  it('observações fora da janela de 90 dias não contam: histórico antigo não sustenta desconto', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000]]);
    current = [mkListing({ priceCents: 14000 })];
    await runDiscovery({ source: s, now: daysAfterT0(100) });
    expect(await prisma.offer.count()).toBe(0); // sem histórico na janela: nem referência nem oferta
    expect(await prisma.priceHistory.count()).toBe(4);
  });

  it('o preço "de" ANUNCIADO pela fonte nunca substitui a referência: usa o histórico próprio mesmo com anúncio maior', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]], { advertisedOriginalPriceCents: 60000 });
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer.originalPriceCents).toBe(20000); // nunca 60000
    expect(offer.discountPct).toBe(30); // nunca 77%
    expect(offer.discountVerified).toBe(true);
  });

  it('só anunciado, mesmo com histórico igual ao preço (sem queda real): nada de desconto verificado', async () => {
    await seedCategory();
    const s = src();
    // preço estável em 20000 mas a fonte "anuncia" de 30000: não há referência acima do preço atual
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 20000]], { advertisedOriginalPriceCents: 30000 });
    expect(await prisma.offer.count()).toBe(0);
    const rows = await prisma.priceHistory.findMany({ orderBy: { observedAt: 'asc' } });
    expect(rows.every((r) => r.originalPriceVerified === false)).toBe(true);
    expect(rows.every((r) => r.originalPriceCents === 30000)).toBe(true); // só registrado como anunciado
  });
});

describe('descoberta: queda de preço x oferta nova', () => {
  it('preço IGUAL ao da última observação não gera oferta, mesmo gravando novas observações', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]]);
    const obs = await prisma.priceHistory.count();
    await runPrices(s, [[12, 14000], [15, 14000]]);
    expect(await prisma.offer.count()).toBe(1);
    expect(await prisma.priceHistory.count()).toBe(obs + 2); // > 2h de intervalo: observações registradas
  });

  it('queda menor que minPriceDropPct não cria oferta; maior cria (limiar configurável)', async () => {
    await seedCategory();
    await updateSettings({ monitoring: { minPriceDropPct: 10 } });
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 18400]]); // -8%
    expect(await prisma.offer.count()).toBe(0);
    await runPrices(s, [[12, 16000]]); // -13% vs 18400
    expect(await prisma.offer.count()).toBe(1);
    expect(await prisma.offer.findFirstOrThrow()).toMatchObject({ priceCents: 16000, originalPriceCents: 20000, discountPct: 20 });
  });

  it('preço sobe e volta a cair após a oferta anterior expirar => NOVA oferta; sem queda, nada', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]]);
    // 24h depois a oferta expira; o preço segue o mesmo: nenhuma oferta nova (não houve queda)
    await runPrices(s, [[34, 14000]]);
    expect((await prisma.offer.findFirstOrThrow()).status).toBe('EXPIRED');
    expect(await prisma.offer.count()).toBe(1);
    // sobe e cai de novo: agora sim
    await runPrices(s, [[37, 17000], [40, 14000]]);
    const offers = await prisma.offer.findMany({ orderBy: { discoveredAt: 'asc' } });
    expect(offers.map((o) => [o.priceCents, o.status])).toEqual([[14000, 'EXPIRED'], [14000, 'DISCOVERED']]);
  });

  it('oferta publicada há mais que republishAfterDays não bloqueia uma nova queda ao mesmo preço', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]]);
    const offer = await prisma.offer.findFirstOrThrow();
    const channel = await prisma.publishingChannel.create({ data: { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila', enabled: true, config: {}, status: 'CONNECTED' } });
    const link = await prisma.affiliateLink.create({ data: { productId: offer.productId, url: 'https://meli.la/x', status: 'VALIDATED' } });
    await prisma.publication.create({
      data: { offerId: offer.id, channelId: channel.id, status: 'SENT', template: offer.kind, messageText: 'x', affiliateLinkId: link.id, idempotencyKey: `${offer.id}:${channel.id}`, sentAt: at(9) },
    });
    await prisma.offer.update({ where: { id: offer.id }, data: { status: 'PUBLISHED' } });

    // 8 dias depois (> 7): preço sobe e cai de novo ao mesmo valor
    const base = 8 * 24 + 9;
    await runPrices(s, [[base, 18000]]);
    expect(await prisma.offer.count()).toBe(1);
    await runPrices(s, [[base + 3, 14000]]);
    const offers = await prisma.offer.findMany({ orderBy: { discoveredAt: 'asc' } });
    expect(offers).toHaveLength(2);
    expect(offers[1]).toMatchObject({ priceCents: 14000, status: 'DISCOVERED' });
  });

  it('queda grande sem confirmação no histórico mas com estoque normal: produto suspenso NÃO gera oferta nem observação', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000]]);
    const obs = await prisma.priceHistory.count();
    await runPrices(s, [[9, 1500]]); // -92,5%
    expect(await prisma.offer.count()).toBe(0);
    expect(await prisma.priceHistory.count()).toBe(obs);
    expect(await prisma.product.findFirstOrThrow()).toMatchObject({ status: 'SUSPENDED' });
  });
});

describe('descoberta: estoque, categorias e isolamento de falhas', () => {
  it('produto sem estoque que volta a ter estoque é reativado (ACTIVE) e volta a ser observado', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000]]);
    await runPrices(s, [[9, 20000]], { availableQuantity: 0 });
    expect((await prisma.product.findFirstOrThrow()).status).toBe('UNAVAILABLE');
    const obs = await prisma.priceHistory.count();
    await runPrices(s, [[12, 20000]]);
    expect((await prisma.product.findFirstOrThrow()).status).toBe('ACTIVE');
    expect(await prisma.priceHistory.count()).toBe(obs + 1);
  });

  it('categorias desativadas ou sem ID/termo nunca chegam à fonte', async () => {
    await seedCategory({ key: 'a', name: 'Ativa', mlCategoryIds: ['MLB1'], sortOrder: 1 });
    await seedCategory({ key: 'off', name: 'Desligada', mlCategoryIds: ['MLB2'], enabled: false, sortOrder: 2 });
    await seedCategory({ key: 'vazia', name: 'Vazia', mlCategoryIds: [], searchTerms: [], sortOrder: 3 });
    await seedCategory({ key: 'termos', name: 'Só termos', mlCategoryIds: [], searchTerms: ['fone bluetooth'], sortOrder: 4 });
    current = [];
    const s = src();
    const stats = await run(s, 0);
    expect(stats.categories).toBe(3); // desligada não conta
    expect(s.calls.map((c) => [c.mlCategoryIds, c.searchTerms])).toEqual([
      [['MLB1'], []],
      [[], ['fone bluetooth']],
    ]);
    expect(await prisma.systemLog.count({ where: { scope: 'discovery', message: { contains: 'Vazia' } } })).toBe(1);
  });

  it('desligar uma categoria depois de monitorada para de consultá-la, sem apagar o que já existe', async () => {
    const cat = await seedCategory();
    current = [mkListing()];
    const s = src();
    await run(s, 0);
    await prisma.category.update({ where: { id: cat.id }, data: { enabled: false } });
    await run(s, 3);
    expect(s.calls).toHaveLength(1);
    expect(await prisma.product.count()).toBe(1);
  });

  it('a mesma listagem repetida na resposta é processada uma única vez', async () => {
    await seedCategory();
    current = [mkListing(), mkListing(), mkListing({ externalId: 'MLB1000000002', title: 'Cafeteira Elétrica Arno 15 Xícaras' })];
    const stats = await run(src(), 0);
    expect(stats).toMatchObject({ found: 2, upserted: 2 });
    expect(await prisma.priceHistory.count()).toBe(2);
  });

  it('uma listagem que quebra no banco (NUL no título) é isolada: as demais são processadas e o erro é registrado', async () => {
    await seedCategory();
    current = [
      mkListing({ externalId: 'MLB1000000001', title: 'Produto com byte nulo \u0000 inválido' }),
      mkListing({ externalId: 'MLB1000000002', title: 'Cafeteira Elétrica Arno 15 Xícaras' }),
    ];
    const stats = await run(src(), 0);
    expect(stats.found).toBe(2);
    expect(stats.upserted).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(await prisma.product.findMany({ select: { externalId: true } })).toEqual([{ externalId: 'MLB1000000002' }]);
    expect(await prisma.systemLog.count({ where: { scope: 'discovery', level: 'ERROR', message: { contains: 'MLB1000000001' } } })).toBe(1);
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).status).toBe('SUCCEEDED');
  });

  it('a falha de uma categoria não impede ofertas das outras; a seguinte rodada normal volta a coletar a que falhou', async () => {
    await seedCategory({ key: 'a', name: 'Cat A', mlCategoryIds: ['MLB1'], sortOrder: 1 });
    await seedCategory({ key: 'b', name: 'Cat B', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    let aFails = true;
    const s = new ScriptedSource((ctx) => {
      if (ctx.mlCategoryIds.includes('MLB1')) {
        if (aFails) throw new Error('falha transitória');
        return [mkListing({ externalId: 'MLB1000000001' })];
      }
      return [mkListing({ externalId: 'MLB1000000002', title: 'Cafeteira Elétrica Arno 15 Xícaras' })];
    });
    const first = await run(s, 0);
    expect(first).toMatchObject({ failedCategories: 1, upserted: 1 });
    aFails = false;
    const second = await run(s, 3);
    expect(second).toMatchObject({ failedCategories: 0, upserted: 2 });
    expect(await prisma.product.count()).toBe(2);
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).runCount).toBe(2);
  });
});

describe('descoberta: idempotência', () => {
  it('rodar duas vezes com os MESMOS dados e o mesmo instante não muda nada (produtos, histórico, ofertas)', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000], [9, 14000]]);
    const snapshot = async () => ({
      products: await prisma.product.count(),
      history: await prisma.priceHistory.count(),
      offers: await prisma.offer.findMany({ select: { id: true, status: true, priceCents: true }, orderBy: { id: 'asc' } }),
    });
    const before = await snapshot();
    const a = await run(s, 9);
    const b = await run(s, 9);
    expect(a.created).toBe(0);
    expect(b.created).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it('a rejeição automática (faixa BELOW) também não se repete ao rodar de novo', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 18000]], { seller: null, quality: null, soldQuantity: null, availableQuantity: null });
    expect(await prisma.offer.count({ where: { status: 'REJECTED' } })).toBe(1);
    await runPrices(s, [[3, 18000], [6, 18000]], { seller: null, quality: null, soldQuantity: null, availableQuantity: null });
    expect(await prisma.offer.count()).toBe(1);
  });

  it('duas execuções CONCORRENTES criam uma única oferta (trava por família) e não duplicam o produto', async () => {
    await seedCategory();
    const s = src();
    await runPrices(s, [[0, 20000], [3, 20000], [6, 20000]]);
    current = [mkListing({ priceCents: 14000 })];
    await Promise.all([run(s, 9), run(s, 9), run(s, 9)]);
    expect(await prisma.offer.count()).toBe(1);
    expect(await prisma.product.count()).toBe(1);
  });

  it('produto novo visto por duas execuções concorrentes não gera erro de unicidade nem duplicata', async () => {
    await seedCategory();
    current = [mkListing()];
    const results = await Promise.all([run(src(), 0), run(src(), 0)]);
    expect(results.every((r) => r.errors.length === 0)).toBe(true);
    expect(await prisma.product.count()).toBe(1);
  });
});
