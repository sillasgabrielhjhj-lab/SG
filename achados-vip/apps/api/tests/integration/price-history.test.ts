import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { DEFAULT_DEDUPE_MINUTES, loadHistory, pruneHistory, recordObservation } from '../../src/services/price-history.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { at, mkListing, seedProduct, T0 } from '../helpers/discovery-fixtures.js';

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});

describe('histórico de preços: registro e persistência', () => {
  it('grava a observação com todos os campos reais da fonte (sem marcar o preço "de" como verificado)', async () => {
    const product = await seedProduct();
    const row = await recordObservation(
      mkListing({
        priceCents: 14990,
        advertisedOriginalPriceCents: 19990,
        availableQuantity: 12,
        soldQuantity: 345,
        coupon: { code: 'VIP10', discountCents: 1000 },
        installments: { quantity: 10, amountCents: 1499, interestFree: true },
        observedAt: at(1),
      }),
      product.id,
    );
    const saved = await prisma.priceHistory.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved).toMatchObject({
      productId: product.id,
      listingId: 'MLB1000000001',
      source: 'ml_api',
      priceCents: 14990,
      originalPriceCents: 19990,
      originalPriceVerified: false,
      availableQuantity: 12,
      soldQuantity: 345,
      couponCode: 'VIP10',
      couponDiscountCents: 1000,
      currency: 'BRL',
    });
    expect(saved.installments).toEqual({ quantity: 10, amountCents: 1499, interestFree: true });
    expect(saved.observedAt.getTime()).toBe(at(1).getTime());
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).lastSeenAt.getTime()).toBe(at(1).getTime());
  });

  it('rotula a origem: fixture => "fixture"', async () => {
    const product = await seedProduct({ source: 'fixture' });
    const row = await recordObservation(mkListing({ source: 'fixture' }), product.id);
    expect(row.source).toBe('fixture');
  });
});

describe('histórico de preços: deduplicação', () => {
  it('observação idêntica dentro da janela não duplica, devolve a existente e atualiza lastSeenAt', async () => {
    const product = await seedProduct();
    const first = await recordObservation(mkListing({ observedAt: at(0) }), product.id);
    const again = await recordObservation(mkListing({ observedAt: at(1) }), product.id); // 60 min < 120
    expect(again.id).toBe(first.id);
    expect(await prisma.priceHistory.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).lastSeenAt.getTime()).toBe(at(1).getTime());
  });

  it('idêntica fora da janela grava nova linha; preço diferente grava mesmo dentro da janela', async () => {
    const product = await seedProduct();
    await recordObservation(mkListing({ observedAt: at(0) }), product.id);
    await recordObservation(mkListing({ observedAt: new Date(at(0).getTime() + (DEFAULT_DEDUPE_MINUTES + 1) * 60_000) }), product.id);
    expect(await prisma.priceHistory.count()).toBe(2);
    await recordObservation(mkListing({ priceCents: 19000, observedAt: new Date(at(0).getTime() + (DEFAULT_DEDUPE_MINUTES + 2) * 60_000) }), product.id);
    expect(await prisma.priceHistory.count()).toBe(3);
  });

  it('janela configurável por chamada', async () => {
    const product = await seedProduct();
    await recordObservation(mkListing({ observedAt: at(0) }), product.id, null, { dedupeMinutes: 10 });
    await recordObservation(mkListing({ observedAt: new Date(at(0).getTime() + 11 * 60_000) }), product.id, null, { dedupeMinutes: 10 });
    expect(await prisma.priceHistory.count()).toBe(2);
  });

  it('mudança de cupom ou do preço anunciado conta como observação diferente', async () => {
    const product = await seedProduct();
    await recordObservation(mkListing({ observedAt: at(0) }), product.id);
    await recordObservation(mkListing({ observedAt: at(0.1), coupon: { code: 'NOVO' } }), product.id);
    await recordObservation(mkListing({ observedAt: at(0.2), advertisedOriginalPriceCents: 30000 }), product.id);
    expect(await prisma.priceHistory.count()).toBe(3);
  });
});

describe('histórico de preços: variações e consulta', () => {
  it('cria ProductVariant uma única vez e liga as observações; loadHistory filtra por variação', async () => {
    const product = await seedProduct();
    await recordObservation(mkListing({ variationId: '555', priceCents: 10000, observedAt: at(0) }), product.id);
    await recordObservation(mkListing({ variationId: '555', priceCents: 9000, observedAt: at(5) }), product.id);
    await recordObservation(mkListing({ variationId: '777', priceCents: 12000, observedAt: at(6) }), product.id);
    await recordObservation(mkListing({ priceCents: 8000, observedAt: at(7) }), product.id);

    const variants = await prisma.productVariant.findMany({ orderBy: { externalId: 'asc' } });
    expect(variants.map((v) => v.externalId)).toEqual(['555', '777']);
    const v555 = variants[0]!;
    const only555 = await loadHistory(product.id, 30, { variantId: v555.id, now: at(8) });
    expect(only555.map((h) => h.priceCents)).toEqual([10000, 9000]);
    const noVariant = await loadHistory(product.id, 30, { variantId: null, now: at(8) });
    expect(noVariant.map((h) => h.priceCents)).toEqual([8000]);
    const all = await loadHistory(product.id, 30, { now: at(8) });
    expect(all).toHaveLength(4);
  });

  it('loadHistory devolve em ordem cronológica e só a janela pedida', async () => {
    const product = await seedProduct();
    const day = 24;
    for (const [h, price] of [[0, 100], [day * 5, 90], [day * 20, 80]] as const) {
      await recordObservation(mkListing({ priceCents: price, observedAt: at(h) }), product.id);
    }
    const now = at(day * 21);
    expect((await loadHistory(product.id, 30, { now })).map((h) => h.priceCents)).toEqual([100, 90, 80]);
    expect((await loadHistory(product.id, 10, { now })).map((h) => h.priceCents)).toEqual([80]);
    expect(await loadHistory(product.id, 0.5, { now })).toEqual([]);
  });
});

describe('histórico de preços: poda por retenção', () => {
  it('remove observações antigas, mas preserva a mais recente de cada produto', async () => {
    const a = await seedProduct({ externalId: 'MLB1' });
    const b = await seedProduct({ externalId: 'MLB2' });
    const old = (d: number) => new Date(T0.getTime() - d * 86_400_000);
    for (const [d, price] of [[400, 100], [380, 95], [10, 90]] as const) {
      await recordObservation(mkListing({ externalId: 'MLB1', priceCents: price, observedAt: old(d) }), a.id);
    }
    await recordObservation(mkListing({ externalId: 'MLB2', priceCents: 50, observedAt: old(500) }), b.id); // única e antiga: fica
    const removed = await pruneHistory({ days: 365, now: T0 });
    expect(removed).toBe(2);
    expect((await prisma.priceHistory.findMany({ where: { productId: a.id } })).map((h) => h.priceCents)).toEqual([90]);
    expect(await prisma.priceHistory.count({ where: { productId: b.id } })).toBe(1);
  });

  it('usa a retenção das configurações quando não informada', async () => {
    const p = await seedProduct();
    await recordObservation(mkListing({ priceCents: 100, observedAt: new Date(Date.now() - 400 * 86_400_000) }), p.id);
    await recordObservation(mkListing({ priceCents: 90, observedAt: new Date() }), p.id);
    expect(await pruneHistory()).toBe(1); // retention.priceHistoryDays padrão = 365
  });
});
