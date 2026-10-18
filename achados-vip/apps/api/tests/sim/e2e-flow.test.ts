/**
 * FLUXO PONTA A PONTA — SIMULADO.
 *
 * Tudo aqui roda contra SIMULADORES locais; NENHUMA chamada real foi feita (o sandbox bloqueia a internet):
 *   - API do Mercado Livre: servidor HTTP local (tests/helpers/sim-ml.ts) falando com o MercadoLivreApiSource REAL;
 *   - Telegram: servidor HTTP local (tests/helpers/sim-telegram.ts) falando com o TelegramPublisher REAL;
 *   - links de afiliado: "hosts virtuais" (meli.la, produto.mercadolivre.com.br) resolvidos pelo safeFetch REAL
 *     (vi.mock do transporte undici + resolver falso), sem DNS nem internet.
 * O que NÃO foi provado: o comportamento das APIs reais (ML, Telegram, portal de afiliados). Isso depende de
 * credenciais reais e do botão "Testar" do painel.
 *
 * Fluxo: fonte (ML simulado) -> runDiscovery -> oferta qualificada sem link (aparece em pendentes) -> importar link de
 * afiliado VALIDADO -> aprovar/enfileirar -> processDue com Telegram simulado -> Publication SENT (texto correto) e
 * Offer PUBLISHED -> segunda rodada não republica (antiduplicidade).
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MercadoLivreApiSource } from '../../src/adapters/sources/mercadolivre.js';
import { prisma } from '../../src/lib/db.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { importBatch } from '../../src/services/affiliate.js';
import { runDiscovery } from '../../src/services/discovery.js';
import { setOfferSourceProvider } from '../../src/services/policy.js';
import { processDue } from '../../src/services/publishing.js';
import { updateSettings } from '../../src/services/settings.js';
import { productUrl, simFetcher } from '../helpers/affiliate-fixtures.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';
import { ML_TEST_CREDS, MlSimulator, mlUser } from '../helpers/sim-ml.js';
import { startSimServer, type SimServer } from '../helpers/sim-server.js';
import { SIM_TG_TOKEN, TelegramSimulator } from '../helpers/sim-telegram.js';
import { clearVirtualHosts, routeVirtualHosts } from '../helpers/sim-virtual-hosts.js';

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  const { wrapUndiciRequest } = await import('../helpers/sim-virtual-hosts.js');
  return { ...actual, request: wrapUndiciRequest(actual.request) };
});

const H = 3_600_000;
const ID = 'MLB1000000001';
const TITLE = 'Fone Bluetooth JBL Tune 520BT Preto';
/** Link de afiliado como o portal o entrega (parâmetros com "&": o Telegram HTML exige &amp; no texto). */
const AFFILIATE_URL = 'https://meli.la/2aBcDeF?matt_tool=achadosvip&matt_word=vip';
const AFFILIATE_URL_IN_HTML = 'https://meli.la/2aBcDeF?matt_tool=achadosvip&amp;matt_word=vip';
const DISCLOSURE = 'Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado.';

let app: FastifyInstance;
let web: SimServer;
let ml: MlSimulator;
let tg: TelegramSimulator;
let source: MercadoLivreApiSource;
let agent: TestAgent;
let categoryId: string;

beforeAll(async () => {
  web = await startSimServer((req, res) => {
    const host = String(req.headers.host ?? '');
    if (host === 'meli.la' && req.path === '/2aBcDeF') {
      res.writeHead(301, { location: productUrl(ID) });
      return void res.end();
    }
    if (host === 'produto.mercadolivre.com.br' && req.path.startsWith('/MLB-1000000001')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(req.method === 'HEAD' ? undefined : '<html><body>Fone JBL</body></html>');
    }
    res.writeHead(404);
    res.end();
  });
  routeVirtualHosts(['meli.la', 'produto.mercadolivre.com.br'], web.port);
  setSsrfAllowPrivateForTests((host) => host === '127.0.0.1'); // só o loopback dos simuladores
  app = await buildTestApp();
});
afterAll(async () => {
  setOfferSourceProvider(null);
  setSsrfAllowPrivateForTests(false);
  clearVirtualHosts();
  await app.close();
  await web.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await createTestAdmin();
  ml = await MlSimulator.start();
  tg = await TelegramSimulator.start();
  source = new MercadoLivreApiSource({ credentials: { ...ML_TEST_CREDS }, baseUrl: ml.baseUrl, allowPrivate: true, minDelayMs: 0, retryBaseDelayMs: 5, timeoutMs: 5000 });
  setOfferSourceProvider(async () => source); // a revalidação de preço também usa o ML simulado
  agent = await loginAgent(app);
  await updateSettings({ publishing: { quietHours: { enabled: false } } }); // o relógio real não pode influenciar o teste
  categoryId = (await prisma.category.create({ data: { key: 'audio', name: 'Áudio', mlCategoryIds: ['MLB1055'], enabled: true, relevance: 80 } })).id;

  // anúncio simulado: "de R$ 400" é só ANUNCIADO pelo ML; o preço real começa em R$ 200
  ml.addItem('MLB1055', ID, {
    title: TITLE,
    price: 200,
    original_price: 400,
    installments: { quantity: 10, amount: 20, rate: 0 },
    seller: { id: 999, nickname: 'LOJA_TESTE' },
    sold_quantity: 800,
  });
  ml.sellers.set('999', mlUser(999));
});
afterEach(async () => {
  await ml.close();
  await tg.close();
});

/** Canal Telegram criado pela API (o teste de conexão roda de verdade contra o simulador). */
async function createTelegramChannel() {
  const cred = await agent.post('/api/integrations/credentials', { provider: 'telegram', name: 'Bot do canal', values: { botToken: SIM_TG_TOKEN } });
  expect(cred.statusCode).toBe(200);
  const res = await agent.post('/api/integrations/channels', {
    type: 'TELEGRAM',
    name: 'Canal Achados VIP',
    credentialId: cred.json().id,
    enabled: true,
    config: { chatId: '@canal_achados_vip', baseUrl: tg.baseUrl },
  });
  expect(res.statusCode, res.body).toBe(200);
  expect(res.json()).toMatchObject({ type: 'TELEGRAM', enabled: true, status: 'CONNECTED', automatic: true });
  return res.json() as { id: string };
}

/** 3 coletas ao mesmo preço (histórico próprio) e uma coleta em queda de 30% (R$ 200 -> R$ 140). */
async function discoverWithDrop(now = new Date()) {
  for (const h of [9, 6, 3]) await runDiscovery({ source, now: new Date(now.getTime() - h * H) });
  expect(await prisma.offer.count()).toBe(0); // sem queda não há oferta
  ml.setPrice(ID, 140);
  ml.items.get(ID)!.search.installments = { quantity: 10, amount: 14, rate: 0 };
  return runDiscovery({ source, now });
}

const EXPECTED_TEXT = [
  '🏆 <b>MAIOR DESCONTO DO DIA!</b>',
  TITLE,
  '',
  'De: <s>R$ 200,00</s>',
  'Por: <b>R$ 140,00</b>',
  '✅ 30% OFF',
  '💳 ou 10x de R$ 14,00 sem juros',
  '',
  '🛒 Comprar com desconto:',
  AFFILIATE_URL_IN_HTML,
  '',
  `<i>${DISCLOSURE}</i>`,
].join('\n');

async function expectNoSecretsStored() {
  const everything = JSON.stringify({
    publications: await prisma.publication.findMany(),
    attempts: await prisma.publicationAttempt.findMany(),
    logs: await prisma.systemLog.findMany(),
    audit: await prisma.auditLog.findMany(),
    notifications: await prisma.notification.findMany(),
    channels: await prisma.publishingChannel.findMany(),
  });
  expect(everything).not.toContain(SIM_TG_TOKEN);
  expect(everything).not.toContain(SIM_TG_TOKEN.split(':')[1]!);
  expect(everything).not.toContain(ML_TEST_CREDS.clientSecret);
}

describe('sim: fluxo ponta a ponta (ML simulado -> descoberta -> afiliado -> publicação Telegram simulada)', () => {
  it('descobre, pede o link, valida o link, aprova, publica com texto correto e NÃO republica na segunda rodada', async () => {
    const channel = await createTelegramChannel();
    expect(tg.calledMethods).toEqual(['getMe', 'getChat']); // teste de conexão real contra o simulador

    // 1) DESCOBERTA: fonte simulada -> oferta qualificada, com desconto VERIFICADO pelo histórico próprio
    const stats = await discoverWithDrop();
    expect(stats).toMatchObject({ created: 1, failedCategories: 0, errors: [] });
    const offer = await prisma.offer.findFirstOrThrow({ include: { product: true } });
    expect(offer).toMatchObject({ status: 'DISCOVERED', priceCents: 14000, originalPriceCents: 20000, discountPct: 30, savingsCents: 6000, discountVerified: true, kind: 'TOP_DISCOUNT_OF_DAY' });
    expect(offer.originalPriceCents).not.toBe(40000); // o "de R$ 400" anunciado nunca vira referência
    expect(['EXCELLENT', 'EXCEPTIONAL']).toContain(offer.tier);
    expect(offer.product).toMatchObject({ externalId: ID, categoryId, title: TITLE, sellerName: 'LOJA_TESTE' });

    // 2) SEM LINK: aparece em pendentes; não dá para publicar; o publicador não envia nada
    const pending = (await agent.get('/api/affiliate/pending')).json();
    expect(pending).toEqual([{ productId: offer.productId, title: TITLE, permalink: offer.product.permalink, offerId: offer.id, score: offer.score }]);
    expect((await agent.get('/api/affiliate/pending.csv')).body).toContain(offer.productId);
    expect((await agent.get(`/api/offers/${offer.id}`)).json()).toMatchObject({ hasValidatedLink: false, messagePreview: null });
    expect((await agent.get('/api/dashboard')).json()).toMatchObject({ pendingAffiliateLinks: 1, today: { discovered: 1, published: 0 } });

    const approve = await agent.post(`/api/offers/${offer.id}/approve`, { note: 'preço ótimo' });
    expect(approve.json()).toMatchObject({ status: 'APPROVED', hasValidatedLink: false });
    const blocked = await agent.post(`/api/offers/${offer.id}/publish`, {});
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('NO_VALIDATED_LINK');
    expect(await processDue(new Date(), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(tg.messages).toHaveLength(0);
    expect(await prisma.publication.count()).toBe(0);

    // 3) IMPORTAR o link de afiliado (do portal): validado pelo destino real (encurtador -> página do produto)
    const imp = await importBatch(`${offer.product.permalink} ; ${AFFILIATE_URL}`, agent.user.id, { fetcher: simFetcher });
    expect(imp).toMatchObject({ imported: 1, validated: 1, pending: 0, invalid: [], unmatched: [] });
    const link = await prisma.affiliateLink.findFirstOrThrow();
    expect(link).toMatchObject({ url: AFFILIATE_URL, status: 'VALIDATED', kind: 'IMPORTED', resolvedItemId: ID });
    expect(link.validationNote).toMatch(/Destino confirmado/);
    expect((await agent.get('/api/affiliate/pending')).json()).toEqual([]);
    expect((await agent.get('/api/dashboard')).json().pendingAffiliateLinks).toBe(0);
    const detail = (await agent.get(`/api/offers/${offer.id}`)).json();
    expect(detail).toMatchObject({ hasValidatedLink: true, status: 'APPROVED' });
    expect(detail.messagePreview.telegram).toBe(EXPECTED_TEXT); // a prévia é exatamente o que será enviado

    // 4) ENFILEIRAR (rota de publicar): cria a Publication PENDING no canal Telegram
    const queued = await agent.post(`/api/offers/${offer.id}/publish`, { channelId: channel.id });
    expect(queued.statusCode, queued.body).toBe(200);
    expect(queued.json().offer.status).toBe('QUEUED');
    expect(queued.json().publications).toHaveLength(1);
    expect(queued.json().publications[0]).toMatchObject({ status: 'PENDING', channelType: 'TELEGRAM', sentAt: null });
    expect(tg.messages).toHaveLength(0); // enfileirar não envia

    // 5) PUBLICADOR: processDue envia pelo adaptador Telegram (simulado)
    const tick = await processDue(new Date(), { source });
    expect(tick).toEqual({ sent: 1, manualReady: 0, failed: 0, skipped: 0 });

    // 6) RESULTADO: Publication SENT (confirmada pelo message_id), Offer PUBLISHED, texto correto
    const pub = await prisma.publication.findFirstOrThrow({ include: { attempts: true } });
    expect(pub).toMatchObject({ status: 'SENT', externalMessageId: '1', attemptsCount: 1, lastError: null, affiliateLinkId: link.id, template: 'TOP_DISCOUNT_OF_DAY', idempotencyKey: `${offer.id}:${channel.id}` });
    expect(pub.sentAt).toBeInstanceOf(Date);
    expect(pub.attempts).toHaveLength(1);
    expect(pub.attempts[0]).toMatchObject({ success: true, httpStatus: 200, error: null });
    expect(pub.messageText).toBe(EXPECTED_TEXT);
    expect(pub.messageText).toContain('R$ 140,00'); // preço REAL (revalidado na fonte)
    expect(pub.messageText).toContain('De: <s>R$ 200,00</s>'); // De/Por só porque o desconto é VERIFICADO
    expect(pub.messageText).not.toContain('400,00'); // o preço "de" anunciado pelo ML nunca aparece
    expect(pub.messageText).toContain(AFFILIATE_URL_IN_HTML); // o link de afiliado, sem alteração
    expect(pub.messageText).toContain(`<i>${DISCLOSURE}</i>`); // rodapé de afiliado

    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0]).toMatchObject({ method: 'sendPhoto', chatId: '@canal_achados_vip', text: EXPECTED_TEXT, parseMode: 'HTML', messageId: 1 });
    expect(tg.messages[0]!.photo).toMatch(/^https:\/\/http2\.mlstatic\.com\//);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('PUBLISHED');

    const viaApi = (await agent.get(`/api/publications/${pub.id}`)).json();
    expect(viaApi).toMatchObject({ status: 'SENT', channelType: 'TELEGRAM', productTitle: TITLE });
    expect(viaApi.attempts[0]).toMatchObject({ success: true, httpStatus: 200 });
    expect((await agent.get(`/api/offers/${offer.id}`)).json()).toMatchObject({ status: 'PUBLISHED', publications: [{ status: 'SENT' }] });
    expect((await agent.get('/api/dashboard')).json().today).toMatchObject({ published: 1, pending: 0, failed: 0 });
    expect((await agent.get('/api/reports/summary')).json()).toMatchObject({ found: 1, approved: 1, published: 1, failed: 0, byCategory: [{ name: 'Áudio', found: 1, qualified: 1, published: 1 }] });
    await expectNoSecretsStored();

    // 7) SEGUNDA RODADA: nada é republicado
    const again = await runDiscovery({ source, now: new Date(Date.now() + 1000) });
    expect(again).toMatchObject({ created: 0, errors: [] });
    expect(await processDue(new Date(), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    const dup = await agent.post(`/api/offers/${offer.id}/publish`, { channelId: channel.id });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('DUPLICATE');

    // o preço sobe e volta a cair ao mesmo valor: a oferta já publicada bloqueia uma nova (antiduplicidade)
    ml.setPrice(ID, 200);
    await runDiscovery({ source, now: new Date(Date.now() + 3 * H) });
    ml.setPrice(ID, 140);
    const rebound = await runDiscovery({ source, now: new Date(Date.now() + 6 * H) });
    expect(rebound.created).toBe(0);
    expect(await prisma.offer.count()).toBe(1);
    expect(await processDue(new Date(Date.now() + 6 * H), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(await prisma.publication.count()).toBe(1);
    expect(tg.messages).toHaveLength(1); // a única mensagem enviada em todo o fluxo
  });

  it('piloto automático: aprovada automaticamente, mas SEM link validado nada sai; com o link importado sai UMA vez', async () => {
    await updateSettings({ publishing: { autoPublish: true } });
    await createTelegramChannel();

    const stats = await discoverWithDrop();
    expect(stats).toMatchObject({ created: 1, approved: 1 });
    const offer = await prisma.offer.findFirstOrThrow({ include: { product: true } });
    expect(offer).toMatchObject({ status: 'APPROVED', decidedBy: 'auto', discountVerified: true });

    // sem link: o publicador tenta, mas a trava de serviço impede qualquer criação/envio
    expect(await processDue(new Date(), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(await prisma.publication.count()).toBe(0);
    expect(tg.messages).toHaveLength(0);
    expect((await agent.get('/api/dashboard')).json()).toMatchObject({ pendingAffiliateLinks: 1, autoPublish: true });

    // link só PENDENTE (rede do portal fora do ar) também não libera
    const down = await importBatch(`${ID};${AFFILIATE_URL}`, agent.user.id, { fetcher: async () => { throw new Error('getaddrinfo ENOTFOUND meli.la'); } });
    expect(down).toMatchObject({ imported: 1, validated: 0, pending: 1 });
    expect(await processDue(new Date(), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(tg.messages).toHaveLength(0);

    // reimportar com a rede de volta valida o mesmo registro e libera o envio
    const up = await importBatch(`${ID};${AFFILIATE_URL}`, agent.user.id, { fetcher: simFetcher });
    expect(up).toMatchObject({ imported: 0, duplicates: 1, validated: 1 });
    expect(await prisma.affiliateLink.count()).toBe(1);
    expect(await processDue(new Date(), { source })).toEqual({ sent: 1, manualReady: 0, failed: 0, skipped: 0 });
    expect(tg.messages).toHaveLength(1);
    expect(tg.messages[0]!.text).toBe(EXPECTED_TEXT);
    expect((await prisma.publication.findFirstOrThrow()).status).toBe('SENT');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('PUBLISHED');

    // repetir o ciclo não reenvia
    expect(await processDue(new Date(), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(await processDue(new Date(Date.now() + 2 * H), { source })).toEqual({ sent: 0, manualReady: 0, failed: 0, skipped: 0 });
    expect(tg.messages).toHaveLength(1);
    await expectNoSecretsStored();
  });

  it('sem desconto verificado a mensagem mostra só o preço atual (nunca o "de" anunciado)', async () => {
    await createTelegramChannel();
    // histórico curto (2 observações): o ML "anuncia" de R$ 400, mas o sistema não tem referência própria
    for (const h of [6, 3]) await runDiscovery({ source, now: new Date(Date.now() - h * H) });
    ml.setPrice(ID, 140);
    ml.items.get(ID)!.search.installments = { quantity: 10, amount: 14, rate: 0 };
    await runDiscovery({ source, now: new Date() });
    const offer = await prisma.offer.findFirstOrThrow();
    expect(offer).toMatchObject({ discountVerified: false, originalPriceCents: null, discountPct: null });
    expect((await agent.post(`/api/offers/${offer.id}/approve`, {})).json().status).toBe('APPROVED'); // decisão do administrador
    await importBatch(`${ID};${AFFILIATE_URL}`, agent.user.id, { fetcher: simFetcher });
    expect((await agent.post(`/api/offers/${offer.id}/publish`, {})).statusCode).toBe(200);
    expect(await processDue(new Date(), { source })).toMatchObject({ sent: 1 });

    const text = tg.messages[0]!.text;
    expect(text).toContain('Preço: <b>R$ 140,00</b>');
    expect(text).not.toMatch(/De:|OFF|400,00|200,00/);
    expect(text).toContain(AFFILIATE_URL_IN_HTML);
    expect(text).toContain(DISCLOSURE);
  });

  it('o preço subiu entre a descoberta e o envio: a oferta expira e NADA é enviado', async () => {
    const channel = await createTelegramChannel();
    await discoverWithDrop();
    const offer = await prisma.offer.findFirstOrThrow();
    await importBatch(`${ID};${AFFILIATE_URL}`, agent.user.id, { fetcher: simFetcher });
    await agent.post(`/api/offers/${offer.id}/approve`, {});
    expect((await agent.post(`/api/offers/${offer.id}/publish`, { channelId: channel.id })).statusCode).toBe(200);

    ml.setPrice(ID, 190); // +35% antes do envio
    const tick = await processDue(new Date(), { source });
    expect(tick.sent).toBe(0);
    expect(tg.messages).toHaveLength(0);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('EXPIRED');
    expect((await prisma.publication.findFirstOrThrow()).status).toBe('CANCELLED');
  });
});
