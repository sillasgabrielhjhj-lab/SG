/**
 * SIMULADO: runDiscovery com a fonte REAL (MercadoLivreApiSource) apontando para o simulador local da API do ML.
 * Verifica a integração fonte -> descoberta -> banco (histórico, referência verificada) e o tratamento de falhas
 * (AUTH_REQUIRED + notificação, limite de taxa, indisponibilidade). Nenhuma chamada real ao Mercado Livre.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadMlCredentials } from '../../src/adapters/sources/credentials.js';
import { createSource, MercadoLivreApiSource } from '../../src/adapters/sources/index.js';
import type { MercadoLivreOptions } from '../../src/adapters/sources/mercadolivre.js';
import { encryptJson } from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/db.js';
import { defaultSettings } from '../../src/domain/settings.js';
import { runDiscovery, testSourceConnection } from '../../src/services/discovery.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { at, seedCategory } from '../helpers/discovery-fixtures.js';
import { ML_TEST_CREDS, MlSimulator, mlUser } from '../helpers/sim-ml.js';

let sim: MlSimulator;
afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  sim = await MlSimulator.start();
});
afterEach(async () => {
  await sim.close();
});

const CAT = 'MLB1055';
const ID = 'MLB1000000001';

function mlSource(over: Partial<MercadoLivreOptions> = {}): MercadoLivreApiSource {
  return new MercadoLivreApiSource({
    credentials: { ...ML_TEST_CREDS },
    baseUrl: sim.baseUrl,
    allowPrivate: true,
    minDelayMs: 0,
    retryBaseDelayMs: 5,
    timeoutMs: 3000,
    ...over,
  });
}
const seedMlCredential = (status = 'CONNECTED') =>
  prisma.integrationCredential.create({ data: { provider: 'mercadolivre', name: 'ML', encrypted: encryptJson({ ...ML_TEST_CREDS }), status } });

describe('sim: descoberta com a fonte ML (dados do simulador)', () => {
  it('grava produtos, vendedor (reputação real), histórico de preços e NÃO cria oferta para produto novo', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    sim.addItem(CAT, ID, { price: 199.9, original_price: 299.9, catalog_product_id: 'MLB777' });
    sim.addItem(CAT, 'MLB1000000002', { title: 'Cafeteira Elétrica Arno 15 Xícaras', price: 249.5, seller: { id: 999, nickname: 'LOJA_TESTE' } });
    sim.sellers.set('999', mlUser(999));

    const stats = await runDiscovery({ source: mlSource(), now: at(0) });
    expect(stats).toMatchObject({ found: 2, upserted: 2, scored: 2, created: 0, failedCategories: 0, errors: [] });

    const products = await prisma.product.findMany({ orderBy: { externalId: 'asc' } });
    expect(products.map((p) => p.externalId)).toEqual([ID, 'MLB1000000002']);
    expect(products[0]).toMatchObject({ source: 'mercadolivre', catalogProductId: 'MLB777', sellerId: '999', sellerName: 'LOJA_TESTE', status: 'ACTIVE' });
    expect(products[0]!.familyKey).toBe('cat:MLB777');
    expect(products[0]!.sellerReputation).toEqual({ reputationLevel: 'green', powerSellerStatus: 'platinum', positiveRatio: 0.99, completedTransactions: 8000 });

    const history = await prisma.priceHistory.findMany({ orderBy: { listingId: 'asc' } });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ source: 'ml_api', priceCents: 19990, originalPriceCents: 29990, originalPriceVerified: false, soldQuantity: 800 });
    expect(history[1]).toMatchObject({ priceCents: 24950, originalPriceCents: null });
    expect(await prisma.offer.count()).toBe(0);
  });

  it('o "preço de" anunciado pelo ML NUNCA vira referência: a oferta usa o maior preço do histórico PRÓPRIO', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    sim.addItem(CAT, ID, { price: 200, original_price: 400 }); // anuncia "de R$ 400"
    sim.sellers.set('999', mlUser(999));
    const src = mlSource();
    for (const h of [0, 3, 6]) await runDiscovery({ source: src, now: at(h) });
    expect(await prisma.offer.count()).toBe(0);

    sim.setPrice(ID, 140);
    const stats = await runDiscovery({ source: src, now: at(9) });
    expect(stats.created).toBe(1);

    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer).toMatchObject({ priceCents: 14000, originalPriceCents: 20000, discountPct: 30, savingsCents: 6000, discountVerified: true });
    expect(offer.originalPriceCents).not.toBe(40000);
    expect(offer.couponCode).toBeNull();
    expect(offer.installments).toMatchObject({ quantity: 10, amountCents: 1999, interestFree: true }); // só porque a API informou
    expect(offer.flash).toBe(false);
  });

  it('sem parcelamento/cupom/relâmpago na resposta, a oferta também não os tem (nada inventado)', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    sim.addItem(CAT, ID, { price: 200, installments: undefined, tags: undefined });
    const src = mlSource();
    for (const h of [0, 3, 6]) await runDiscovery({ source: src, now: at(h) });
    sim.setPrice(ID, 140);
    await runDiscovery({ source: src, now: at(9) });
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer.installments).toBeNull();
    expect(offer.couponCode).toBeNull();
    expect(offer.couponDiscountCents).toBeNull();
    expect(offer.flash).toBe(false);
    expect(offer.kind).not.toBe('FLASH');
    expect(offer.kind).not.toBe('COUPON');
  });

  it('o refresh_token rotacionado é PERSISTIDO (criptografado) e a próxima rodada, com fonte nova, continua funcionando', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    sim.addItem(CAT, ID);
    await seedMlCredential();
    const opts = { mercadolivre: { baseUrl: sim.baseUrl, allowPrivate: true, minDelayMs: 0, retryBaseDelayMs: 5 } } as const;

    const creds = await loadMlCredentials();
    expect(creds?.refreshToken).toBe('RT-0');
    await runDiscovery({ source: createSource(defaultSettings(), creds, opts), now: at(0) });
    expect((await loadMlCredentials())?.refreshToken).toBe('RT-1');
    expect(JSON.stringify(await prisma.integrationCredential.findMany())).not.toContain('RT-1'); // cifrado em repouso

    // outra "execução do worker": credencial vem do banco (já rotacionada)
    const stats = await runDiscovery({ source: createSource(defaultSettings(), await loadMlCredentials(), opts), now: at(1) });
    expect(stats.errors).toEqual([]);
    expect((await loadMlCredentials())?.refreshToken).toBe('RT-2');
    expect(await prisma.integrationCredential.count()).toBe(1);
  });
});

describe('sim: falhas da fonte ML refletidas na integração e nos alertas', () => {
  const searchStatus = (status: number, extra: Record<string, string> = {}) => sim.script('search', { status, headers: extra, body: { message: 'erro simulado' } });

  it('403 na busca => integração AUTH_REQUIRED, UMA notificação (sem duplicar), job FAILED e nada gravado; ao voltar => CONNECTED e alerta resolvido', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    await seedCategory({ key: 'outra', name: 'Outra', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    sim.addItem(CAT, ID);
    await seedMlCredential();
    const src = mlSource();

    searchStatus(403);
    const first = await runDiscovery({ source: src, now: at(0) });
    searchStatus(403);
    await runDiscovery({ source: src, now: at(1) });

    expect(first.failedCategories).toBe(1);
    expect(first.errors[0]).toMatch(/403/);
    expect(sim.calls('search')).toHaveLength(2); // 1 por rodada: a 2ª categoria não foi tentada
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('AUTH_REQUIRED');
    const notes = await prisma.notification.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: 'integration_auth_required', level: 'ERROR', readAt: null });
    expect(notes[0]!.body).toMatch(/403/);
    expect(await prisma.product.count()).toBe(0);
    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } });
    expect(job).toMatchObject({ status: 'FAILED', failCount: 2 });
    expect(job.lastSuccessAt).toBeNull();

    const ok = await runDiscovery({ source: src, now: at(2) });
    expect(ok.errors).toEqual([]);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('CONNECTED');
    expect((await prisma.notification.findFirstOrThrow()).readAt).not.toBeNull();
    expect((await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } })).status).toBe('SUCCEEDED');
  });

  it('refresh_token recusado (invalid_grant) => AUTH_REQUIRED + notificação', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    await seedMlCredential();
    const stats = await runDiscovery({ source: mlSource({ credentials: { ...ML_TEST_CREDS, refreshToken: 'RT-expirado' } }), now: at(0) });
    expect(stats.errors[0]).toMatch(/renovar o token/i);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('AUTH_REQUIRED');
    expect(await prisma.notification.findFirstOrThrow()).toMatchObject({ type: 'integration_auth_required' });
  });

  it('sem credenciais (fonte não configurada) => SourceAuthError => AUTH_REQUIRED, sem nenhuma chamada de rede', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    await seedMlCredential('UNKNOWN');
    const src = new MercadoLivreApiSource({ credentials: null, baseUrl: sim.baseUrl, allowPrivate: true });
    await runDiscovery({ source: src, now: at(0) });
    expect(sim.requests).toHaveLength(0);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('AUTH_REQUIRED');
  });

  it('429 com Retry-After longo => rodada interrompida; integração fica em ERROR (não AUTH_REQUIRED) e o alerta é de falha da fonte', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    await seedCategory({ key: 'outra', name: 'Outra', mlCategoryIds: ['MLB2'], sortOrder: 2 });
    await seedMlCredential();
    searchStatus(429, { 'retry-after': '120' });
    const stats = await runDiscovery({ source: mlSource({ maxRetryAfterWaitMs: 50 }), now: at(0) });
    expect(stats.failedCategories).toBe(1);
    expect(sim.calls('search')).toHaveLength(1);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('ERROR');
    expect(await prisma.notification.findFirstOrThrow()).toMatchObject({ type: 'source_error' });
    expect(await prisma.notification.count({ where: { type: 'integration_auth_required' } })).toBe(0);
  });

  it('5xx persistente => ERROR + alerta "source_error"; a recuperação resolve o alerta', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    sim.addItem(CAT, ID);
    await seedMlCredential();
    const src = mlSource();
    sim.script('search', { status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} });
    const bad = await runDiscovery({ source: src, now: at(0) });
    expect(bad.errors[0]).toMatch(/indispon/i);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('ERROR');
    expect((await prisma.notification.findFirstOrThrow()).readAt).toBeNull();

    await runDiscovery({ source: src, now: at(1) });
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('CONNECTED');
    expect((await prisma.notification.findFirstOrThrow()).readAt).not.toBeNull();
  });

  it('timeout e JSON inválido também viram falha de categoria registrada (sem derrubar o processo)', async () => {
    await seedCategory({ mlCategoryIds: [CAT] });
    await seedMlCredential();
    const src = mlSource({ timeoutMs: 120, maxRetries: 0 });
    sim.script('search', { hang: true });
    const timeout = await runDiscovery({ source: src, now: at(0) });
    expect(timeout.failedCategories).toBe(1);
    expect(timeout.errors[0]).toMatch(/Tempo limite/);

    sim.script('search', { status: 200, raw: '<html>manutenção</html>' });
    const invalid = await runDiscovery({ source: src, now: at(1) });
    expect(invalid.errors[0]).toMatch(/não é JSON/);
    expect(await prisma.systemLog.count({ where: { scope: 'discovery', level: 'ERROR' } })).toBeGreaterThanOrEqual(2);
  });

  it('categoria com ID inválido (400) falha sozinha: as outras categorias continuam e o job termina com sucesso parcial', async () => {
    await seedCategory({ key: 'ruim', name: 'Categoria ruim', mlCategoryIds: ['MLB0'], sortOrder: 1 });
    await seedCategory({ key: 'boa', name: 'Categoria boa', mlCategoryIds: [CAT], sortOrder: 2 });
    sim.badCategories.add('MLB0');
    sim.addItem(CAT, ID);
    await seedMlCredential();
    const stats = await runDiscovery({ source: mlSource(), now: at(0) });
    expect(stats).toMatchObject({ categories: 2, failedCategories: 1, found: 1, upserted: 1 });
    expect(stats.errors[0]).toMatch(/Categoria ruim/);
    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'discovery' } });
    expect(job.status).toBe('SUCCEEDED');
    expect(job.lastError).toMatch(/Categoria ruim/);
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('CONNECTED');
  });

  it('testSourceConnection: 403 => AUTH_REQUIRED + alerta; depois OK => CONNECTED e alerta resolvido', async () => {
    await seedMlCredential('UNKNOWN');
    const src = mlSource();
    sim.script('search', { status: 403, body: { message: 'forbidden' } });
    const bad = await testSourceConnection(src);
    expect(bad).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('AUTH_REQUIRED');
    expect(await prisma.notification.count({ where: { type: 'integration_auth_required', readAt: null } })).toBe(1);

    const good = await testSourceConnection(src);
    expect(good).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect((await prisma.integrationCredential.findFirstOrThrow()).status).toBe('CONNECTED');
    expect(await prisma.notification.count({ where: { type: 'integration_auth_required', readAt: null } })).toBe(0);
  });
});
