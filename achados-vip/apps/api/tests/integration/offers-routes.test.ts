/**
 * Rotas /api/offers*: listagem (filtros, ordenação, paginação), detalhe (histórico, links, prévia da mensagem),
 * aprovar/rejeitar (idempotência, estados) e publicar (409 com `code` quando uma regra bloqueia — sobretudo a
 * ausência de link de afiliado VALIDADO). Exige login e CSRF.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { setOfferSourceProvider } from '../../src/services/policy.js';
import { updateSettings } from '../../src/services/settings.js';
import { seedLinkFor, seedManualChannel, seedMlProduct, seedOfferFor } from '../helpers/affiliate-fixtures.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

let app: FastifyInstance;
let agent: TestAgent;

beforeAll(async () => {
  app = await buildTestApp();
  setOfferSourceProvider(async () => null); // sem revalidação de preço na fonte (isto não é teste de fonte)
});
afterAll(async () => {
  setOfferSourceProvider(null);
  await app.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await createTestAdmin();
  agent = await loginAgent(app);
  await updateSettings({ publishing: { quietHours: { enabled: false } } }); // o relógio real não pode influenciar o teste
});
afterEach(() => undefined);

const H = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms);

describe('/api/offers — autenticação, CSRF e perfil', () => {
  const mutations = ['/api/offers/x/approve', '/api/offers/x/reject', '/api/offers/x/publish'];

  it('sem sessão => 401 em todas as rotas', async () => {
    for (const url of ['/api/offers', '/api/offers/x']) expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(401);
    for (const url of mutations) expect((await app.inject({ method: 'POST', url, payload: {} })).statusCode, url).toBe(401);
  });

  it('mutações sem CSRF (ou com CSRF errado) => 403 CSRF_INVALID', async () => {
    for (const url of mutations) {
      const none = await app.inject({ method: 'POST', url, headers: { cookie: agent.cookie }, payload: {} });
      expect(none.statusCode, url).toBe(403);
      expect(none.json().error.code).toBe('CSRF_INVALID');
      const wrong = await app.inject({ method: 'POST', url, headers: { cookie: agent.cookie, 'x-csrf-token': 'errado' }, payload: {} });
      expect(wrong.statusCode).toBe(403);
    }
  });

  it('VIEWER lê ofertas mas não aprova, rejeita nem publica (403 FORBIDDEN) — e nada muda no banco', async () => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status: 'DISCOVERED' });
    await createTestAdmin({ email: 'leitor@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'leitor@teste.local' });
    expect((await viewer.get('/api/offers')).statusCode).toBe(200);
    expect((await viewer.get(`/api/offers/${offer.id}`)).statusCode).toBe(200);
    for (const action of ['approve', 'reject', 'publish']) {
      const res = await viewer.post(`/api/offers/${offer.id}/${action}`, {});
      expect(res.statusCode, action).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    }
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('DISCOVERED');
  });
});

describe('GET /api/offers — listagem, filtros, ordenação e paginação', () => {
  async function seed() {
    const catA = await prisma.category.create({ data: { key: 'a', name: 'Áudio', mlCategoryIds: ['MLB1'], enabled: true } });
    const catB = await prisma.category.create({ data: { key: 'b', name: 'Cozinha', mlCategoryIds: ['MLB2'], enabled: true } });
    const fone = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Fone Bluetooth JBL Tune 520BT', categoryId: catA.id });
    const caixa = await seedMlProduct({ externalId: 'MLB1000000002', title: 'Caixa de Som JBL Flip', categoryId: catA.id });
    const cafe = await seedMlProduct({ externalId: 'MLB1000000003', title: 'Cafeteira Elétrica Arno', categoryId: catB.id });
    const sem = await seedMlProduct({ externalId: 'MLB1000000004', title: 'Produto sem categoria' });
    const o1 = await seedOfferFor(fone.id, { status: 'DISCOVERED', score: 80, discountPct: 30, originalPriceCents: 20000, savingsCents: 6000, discountVerified: true, priceCents: 14000, discoveredAt: ago(1 * H) });
    const o2 = await seedOfferFor(caixa.id, { status: 'APPROVED', score: 92, discountPct: 15, originalPriceCents: 40000, savingsCents: 6000, discountVerified: true, priceCents: 34000, discoveredAt: ago(2 * H) });
    const o3 = await seedOfferFor(cafe.id, { status: 'REJECTED', score: 61, tier: 'GOOD', discoveredAt: ago(3 * H) });
    const o4 = await seedOfferFor(sem.id, { status: 'PUBLISHED', score: 75, discountPct: 50, originalPriceCents: 20000, savingsCents: 10000, discountVerified: true, priceCents: 10000, discoveredAt: ago(4 * H) });
    await seedLinkFor(caixa.id, { status: 'VALIDATED' });
    await seedLinkFor(fone.id, { status: 'PENDING' });
    return { catA, catB, o1, o2, o3, o4 };
  }
  const list = async (qs = '') => {
    const res = await agent.get(`/api/offers${qs ? `?${qs}` : ''}`);
    expect(res.statusCode, qs).toBe(200);
    return res.json() as { items: { id: string; status: string; hasValidatedLink: boolean; discountPct: number | null; discoveredAt: string }[]; total: number; page: number; pageSize: number };
  };

  it('padrão: mais recentes primeiro, com envelope de paginação e DTO do contrato', async () => {
    const { o1, o2, o3, o4 } = await seed();
    const body = await list();
    expect(body).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    expect(body.items.map((i) => i.id)).toEqual([o1.id, o2.id, o3.id, o4.id]);
    expect(Object.keys(body.items[0]!).sort()).toEqual(
      ['couponCode', 'discountPct', 'discountVerified', 'discoveredAt', 'hasValidatedLink', 'id', 'kind', 'originalPriceCents', 'priceCents', 'product', 'savingsCents', 'score', 'scoreBreakdown', 'status', 'tier'].sort(),
    );
    expect(body.items[0]).toMatchObject({ priceCents: 14000, originalPriceCents: 20000, discountPct: 30, savingsCents: 6000, discountVerified: true });
    expect(body.items[0]).toMatchObject({ product: { title: 'Fone Bluetooth JBL Tune 520BT', category: { name: 'Áudio' }, sellerName: null } });
    expect(Object.keys((body.items[0] as unknown as { product: object }).product).sort()).toEqual(['category', 'id', 'permalink', 'sellerName', 'thumbnail', 'title']);
    expect(typeof body.items[0]!.discoveredAt).toBe('string');
    expect(body.items[3]!.discountPct).toBe(50);
    expect((body.items[2] as unknown as { product: { category: unknown } }).product.category).toMatchObject({ name: 'Cozinha' });
  });

  it('hasValidatedLink é verdadeiro só com link VALIDADO (PENDING não conta)', async () => {
    const { o1, o2 } = await seed();
    const byId = Object.fromEntries((await list()).items.map((i) => [i.id, i.hasValidatedLink]));
    expect(byId[o2.id]).toBe(true);
    expect(byId[o1.id]).toBe(false);
  });

  it('filtro por status: um, vários (vírgula) e caixa baixa; vazio = sem filtro', async () => {
    const { o1, o2, o4 } = await seed();
    expect((await list('status=APPROVED')).items.map((i) => i.id)).toEqual([o2.id]);
    expect((await list('status=approved,discovered')).items.map((i) => i.id).sort()).toEqual([o1.id, o2.id].sort());
    expect((await list('status=PUBLISHED')).items.map((i) => i.id)).toEqual([o4.id]);
    expect((await list('status=')).total).toBe(4);
    expect((await list('status=EXPIRED')).total).toBe(0);
  });

  it('filtros por categoria, pontuação mínima e busca por título (sem diferenciar caixa)', async () => {
    const { catA, catB, o1, o2, o3 } = await seed();
    expect((await list(`categoryId=${catA.id}`)).items.map((i) => i.id)).toEqual([o1.id, o2.id]);
    expect((await list(`categoryId=${catB.id}`)).items.map((i) => i.id)).toEqual([o3.id]);
    expect((await list('minScore=80')).items.map((i) => i.id)).toEqual([o1.id, o2.id]);
    expect((await list('minScore=93')).total).toBe(0);
    expect((await list('q=jbl')).items.map((i) => i.id)).toEqual([o1.id, o2.id]);
    expect((await list('q=CAFETEIRA')).items.map((i) => i.id)).toEqual([o3.id]);
    expect((await list('q=jbl&minScore=90')).items.map((i) => i.id)).toEqual([o2.id]);
    expect((await list('q=jbl&status=REJECTED')).total).toBe(0);
    expect((await list('q=%25')).total).toBe(0); // "%" e "_" são texto, não curingas do LIKE
    expect((await list('q=_')).total).toBe(0);
    expect((await list('q=Fone%25')).total).toBe(0);
    const pct = await seedMlProduct({ externalId: 'MLB1000000005', title: 'Notebook 50% mais rápido_pro' });
    await seedOfferFor(pct.id, { status: 'DISCOVERED' });
    expect((await list('q=50%25')).total).toBe(1);
    expect((await list('q=r%C3%A1pido_pro')).total).toBe(1);
    expect((await list('q=rápido_pro')).total).toBe(1);
    expect((await list('q=r%25o')).total).toBe(0);
  });

  it('ordenação: score (desc), discountPct (desc, sem desconto por último) e discoveredAt (desc)', async () => {
    const { o1, o2, o3, o4 } = await seed();
    expect((await list('sort=score')).items.map((i) => i.id)).toEqual([o2.id, o1.id, o4.id, o3.id]);
    expect((await list('sort=discountPct')).items.map((i) => i.id)).toEqual([o4.id, o1.id, o2.id, o3.id]);
    expect((await list('sort=discoveredAt')).items.map((i) => i.id)).toEqual([o1.id, o2.id, o3.id, o4.id]);
  });

  it('paginação: página/tamanho, total constante e página além do fim vazia', async () => {
    const { o1, o2, o3, o4 } = await seed();
    const p1 = await list('pageSize=3');
    expect(p1).toMatchObject({ total: 4, page: 1, pageSize: 3 });
    expect(p1.items.map((i) => i.id)).toEqual([o1.id, o2.id, o3.id]);
    const p2 = await list('pageSize=3&page=2');
    expect(p2.items.map((i) => i.id)).toEqual([o4.id]);
    expect((await list('pageSize=3&page=9')).items).toEqual([]);
  });

  it('parâmetros inválidos => 400 VALIDATION_ERROR', async () => {
    for (const qs of ['status=FOO', 'status=APPROVED,FOO', 'minScore=101', 'minScore=-1', 'minScore=abc', 'sort=preco', 'page=0', 'pageSize=0', 'pageSize=101', `q=${'x'.repeat(101)}`]) {
      const res = await agent.get(`/api/offers?${qs}`);
      expect(res.statusCode, qs).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('NUNCA expõe preço "de"/desconto de uma oferta sem referência verificada (mesmo que o banco tenha o valor)', async () => {
    const p = await seedMlProduct();
    await seedOfferFor(p.id, { discountVerified: false, originalPriceCents: 99900, discountPct: 80, savingsCents: 80000, priceCents: 19900 });
    const [item] = (await list()).items as unknown as { originalPriceCents: number | null; discountPct: number | null; savingsCents: number | null; discountVerified: boolean }[];
    expect(item).toMatchObject({ discountVerified: false, originalPriceCents: null, discountPct: null, savingsCents: null });
  });

  it('banco vazio: lista vazia honesta', async () => {
    expect(await list()).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});

describe('GET /api/offers/:id', () => {
  it('404 para id inexistente', async () => {
    const res = await agent.get('/api/offers/nao-existe');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('detalhe: histórico (do mais antigo ao mais recente), links, publicações e SEM prévia enquanto não há link validado', async () => {
    const p = await seedMlProduct({ externalId: 'MLB1000000001' });
    const offer = await seedOfferFor(p.id, { priceCents: 14000 });
    for (const [h, price] of [[30, 20000], [20, 20000], [10, 14000]] as const) {
      await prisma.priceHistory.create({ data: { productId: p.id, listingId: p.externalId, source: 'ml_api', priceCents: price, originalPriceCents: price === 14000 ? 30000 : null, observedAt: ago(h * H) } });
    }
    await seedLinkFor(p.id, { status: 'PENDING', url: 'https://meli.la/pendente' });
    const body = (await agent.get(`/api/offers/${offer.id}`)).json();
    expect(body.id).toBe(offer.id);
    expect(body.priceHistory.map((h: { priceCents: number }) => h.priceCents)).toEqual([20000, 20000, 14000]);
    expect(body.priceHistory[2]).toMatchObject({ originalPriceCents: 30000, source: 'ml_api' });
    expect(body.affiliateLinks).toHaveLength(1);
    expect(body.affiliateLinks[0]).toMatchObject({ status: 'PENDING', url: 'https://meli.la/pendente' });
    expect(body.publications).toEqual([]);
    expect(body.hasValidatedLink).toBe(false);
    expect(body.messagePreview).toBeNull(); // sem link validado não há mensagem
  });

  it('com link validado: prévia WhatsApp/Telegram com o link de afiliado, preço real e rodapé', async () => {
    const p = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Fone Bluetooth JBL Tune 520BT' });
    const offer = await seedOfferFor(p.id, { priceCents: 19990, discountVerified: false });
    await seedLinkFor(p.id, { url: 'https://meli.la/2aBcDeF' });
    const body = (await agent.get(`/api/offers/${offer.id}`)).json();
    expect(body.hasValidatedLink).toBe(true);
    const { whatsapp, telegram } = body.messagePreview;
    for (const text of [whatsapp, telegram]) {
      expect(text).toContain('R$ 199,90');
      expect(text).toContain('https://meli.la/2aBcDeF');
      expect(text).toContain('Link de afiliado.');
      expect(text).not.toMatch(/De:|OFF/); // sem referência verificada: só o preço atual
    }
    expect(whatsapp).toContain('*OFERTA DO DIA!*');
    expect(telegram).toContain('<b>OFERTA DO DIA!</b>');
  });

  it('com desconto VERIFICADO a prévia mostra De/Por e a porcentagem; com parcelamento da fonte, mostra as parcelas', async () => {
    const p = await seedMlProduct({ externalId: 'MLB1000000001' });
    const offer = await seedOfferFor(p.id, {
      priceCents: 14000,
      originalPriceCents: 20000,
      discountPct: 30,
      savingsCents: 6000,
      discountVerified: true,
      installments: { quantity: 10, amountCents: 1400, interestFree: true },
    });
    await seedLinkFor(p.id, { url: 'https://meli.la/abc' });
    const { whatsapp } = (await agent.get(`/api/offers/${offer.id}`)).json().messagePreview;
    expect(whatsapp).toContain('De: ~R$ 200,00~');
    expect(whatsapp).toContain('Por: *R$ 140,00*');
    expect(whatsapp).toContain('30% OFF');
    expect(whatsapp).toContain('10x de R$ 14,00 sem juros');
  });

  it('inclui as publicações da oferta', async () => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status: 'APPROVED' });
    const link = await seedLinkFor(p.id);
    const channel = await seedManualChannel('Fila do admin');
    await prisma.publication.create({
      data: { offerId: offer.id, channelId: channel.id, status: 'MANUAL_READY', template: 'COMMON', messageText: 'texto pronto', affiliateLinkId: link.id, idempotencyKey: `${offer.id}:${channel.id}`, scheduledFor: new Date() },
    });
    const pubs = (await agent.get(`/api/offers/${offer.id}`)).json().publications;
    expect(pubs).toHaveLength(1);
    expect(pubs[0]).toMatchObject({ offerId: offer.id, channelName: 'Fila do admin', channelType: 'WHATSAPP_MANUAL_QUEUE', status: 'MANUAL_READY', messageText: 'texto pronto', productTitle: p.title });
  });
});

describe('POST /api/offers/:id/approve e /reject', () => {
  it('aprova (registra quem, quando e a nota), audita e é idempotente', async () => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status: 'DISCOVERED' });
    const res = await agent.post(`/api/offers/${offer.id}/approve`, { note: '  preço ótimo  ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: offer.id, status: 'APPROVED' });
    const row = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(row).toMatchObject({ status: 'APPROVED', decidedBy: agent.user.id, decisionNote: 'preço ótimo' });
    expect(row.decidedAt).toBeInstanceOf(Date);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'offer.approve', entityId: offer.id } });
    expect(audit).toMatchObject({ userId: agent.user.id, entity: 'Offer', before: { status: 'DISCOVERED' } });

    const again = await agent.post(`/api/offers/${offer.id}/approve`, {});
    expect(again.statusCode).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'offer.approve' } })).toBe(1); // repetir não audita de novo
  });

  it('aceita corpo vazio (sem JSON) e rejeita campos desconhecidos / nota longa demais', async () => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status: 'DISCOVERED' });
    const empty = await app.inject({ method: 'POST', url: `/api/offers/${offer.id}/approve`, headers: agent.headers() });
    expect(empty.statusCode).toBe(200);
    for (const body of [{ note: 'x'.repeat(501) }, { nota: 'x' }, { note: 5 }]) {
      const res = await agent.post(`/api/offers/${offer.id}/reject`, body);
      expect(res.statusCode, JSON.stringify(body).slice(0, 30)).toBe(400);
    }
  });

  it('rejeita uma oferta aprovada; uma rejeitada pode ser aprovada depois', async () => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status: 'APPROVED' });
    expect((await agent.post(`/api/offers/${offer.id}/reject`, { note: 'repetida' })).json().status).toBe('REJECTED');
    expect(await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ status: 'REJECTED', decisionNote: 'repetida', decidedBy: agent.user.id });
    expect((await agent.post(`/api/offers/${offer.id}/approve`, {})).json().status).toBe('APPROVED');
  });

  it.each(['EXPIRED', 'PUBLISHED', 'QUEUED', 'SUSPENDED'] as const)('oferta %s não pode ser aprovada nem rejeitada (409 INVALID_STATE)', async (status) => {
    const p = await seedMlProduct();
    const offer = await seedOfferFor(p.id, { status });
    for (const action of ['approve', 'reject']) {
      const res = await agent.post(`/api/offers/${offer.id}/${action}`, {});
      expect(res.statusCode, `${status} ${action}`).toBe(409);
      expect(res.json().error).toMatchObject({ code: 'INVALID_STATE', details: { status } });
    }
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe(status);
  });

  it('produto suspenso/indisponível não pode ser aprovado (409 SUSPENDED_PRODUCT)', async () => {
    const p = await seedMlProduct({ status: 'SUSPENDED' });
    const offer = await seedOfferFor(p.id, { status: 'DISCOVERED' });
    const res = await agent.post(`/api/offers/${offer.id}/approve`, {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SUSPENDED_PRODUCT');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('DISCOVERED');
    // rejeitar continua possível
    expect((await agent.post(`/api/offers/${offer.id}/reject`, {})).statusCode).toBe(200);
  });

  it('404 para oferta inexistente', async () => {
    expect((await agent.post('/api/offers/nao-existe/approve', {})).statusCode).toBe(404);
    expect((await agent.post('/api/offers/nao-existe/reject', {})).statusCode).toBe(404);
  });
});

describe('POST /api/offers/:id/publish — regras de publicação (409 com code)', () => {
  async function approved(over: { productStatus?: string; offerStatus?: 'APPROVED' | 'DISCOVERED' | 'REJECTED' | 'EXPIRED'; expiresAt?: Date | null; link?: 'VALIDATED' | 'PENDING' | 'INVALID' | null } = {}) {
    const p = await seedMlProduct({ ...(over.productStatus ? { status: over.productStatus } : {}) });
    const offer = await seedOfferFor(p.id, { status: over.offerStatus ?? 'APPROVED', score: 90, expiresAt: over.expiresAt === undefined ? new Date(Date.now() + 20 * H) : over.expiresAt });
    const link = over.link === null ? null : await seedLinkFor(p.id, { status: over.link ?? 'VALIDATED', url: 'https://meli.la/2aBcDeF' });
    return { p, offer, link };
  }
  const publish = (id: string, body: unknown = {}) => agent.post(`/api/offers/${id}/publish`, body);
  const code = (res: Awaited<ReturnType<typeof publish>>) => res.json().error?.code;

  it('404 para oferta inexistente', async () => {
    expect((await publish('nao-existe')).statusCode).toBe(404);
  });

  it('SEM link de afiliado => 409 NO_VALIDATED_LINK; nada é criado e a oferta continua APPROVED', async () => {
    await seedManualChannel();
    const { offer } = await approved({ link: null });
    const res = await publish(offer.id);
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('NO_VALIDATED_LINK');
    expect(res.json().error.message).toMatch(/link de afiliado validado/);
    expect(await prisma.publication.count()).toBe(0);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('APPROVED');
  });

  it.each(['PENDING', 'INVALID'] as const)('link %s também NÃO basta => 409 NO_VALIDATED_LINK', async (link) => {
    await seedManualChannel();
    const { offer } = await approved({ link });
    const res = await publish(offer.id);
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('NO_VALIDATED_LINK');
    expect(await prisma.publication.count()).toBe(0);
  });

  it('link validado mas host removido da lista permitida => 409 NO_VALIDATED_LINK (defesa em profundidade)', async () => {
    await seedManualChannel();
    const { offer } = await approved();
    await updateSettings({ affiliate: { allowedHosts: ['mercadolivre.com.br'] } });
    expect(code(await publish(offer.id))).toBe('NO_VALIDATED_LINK');
  });

  it('oferta não aprovada (DISCOVERED/REJECTED) => 409 OFFER_NOT_APPROVED; expirada => 409 STALE_PRICE', async () => {
    await seedManualChannel();
    const discovered = await approved({ offerStatus: 'DISCOVERED' });
    expect(code(await publish(discovered.offer.id))).toBe('OFFER_NOT_APPROVED');
    const rejected = await approved({ offerStatus: 'REJECTED' });
    expect(code(await publish(rejected.offer.id))).toBe('OFFER_NOT_APPROVED');
    const expired = await approved({ offerStatus: 'EXPIRED' });
    expect(code(await publish(expired.offer.id))).toBe('STALE_PRICE');
    const late = await approved({ expiresAt: new Date(Date.now() - H) });
    expect(code(await publish(late.offer.id))).toBe('STALE_PRICE');
    expect(await prisma.publication.count()).toBe(0);
  });

  it('produto suspenso => 409 SUSPENDED_PRODUCT; sem canal habilitado => 409 CHANNEL_DISABLED', async () => {
    const suspended = await approved({ productStatus: 'SUSPENDED' });
    await seedManualChannel();
    expect(code(await publish(suspended.offer.id))).toBe('SUSPENDED_PRODUCT');

    await prisma.publishingChannel.updateMany({ data: { enabled: false } });
    const ok = await approved();
    expect(code(await publish(ok.offer.id))).toBe('CHANNEL_DISABLED');
  });

  it('canal informado inexistente => 404; corpo inválido => 400', async () => {
    await seedManualChannel();
    const { offer } = await approved();
    expect((await publish(offer.id, { channelId: 'nao-existe' })).statusCode).toBe(404);
    expect((await publish(offer.id, { channelId: '' })).statusCode).toBe(400);
    expect((await publish(offer.id, { canal: 'x' })).statusCode).toBe(400);
  });

  it('com link validado + oferta aprovada + canal: cria a publicação na fila manual (MANUAL_READY, nunca SENT) e a oferta passa a QUEUED', async () => {
    const channel = await seedManualChannel('Fila manual');
    const { offer } = await approved();
    const res = await publish(offer.id, { channelId: channel.id });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offer).toMatchObject({ id: offer.id, status: 'QUEUED', hasValidatedLink: true });
    expect(body.publications).toHaveLength(1);
    expect(body.publications[0]).toMatchObject({ offerId: offer.id, channelId: channel.id, channelType: 'WHATSAPP_MANUAL_QUEUE', status: 'MANUAL_READY', sentAt: null });
    expect(body.publications[0].messageText).toContain('https://meli.la/2aBcDeF');
    expect(body.publications[0].messageText).toContain('Link de afiliado.');
    const pub = await prisma.publication.findFirstOrThrow();
    expect(pub.idempotencyKey).toBe(`${offer.id}:${channel.id}`);
    expect(pub.status).not.toBe('SENT');

    // a publicação aparece na rota de publicações e na de detalhe
    const listed = (await agent.get('/api/publications')).json();
    expect(listed.items.map((p: { id: string }) => p.id)).toEqual([pub.id]);
  });

  it('segunda tentativa de publicar a mesma oferta no mesmo canal => 409 DUPLICATE (sem duplicar a publicação)', async () => {
    const channel = await seedManualChannel();
    const { offer } = await approved();
    expect((await publish(offer.id, { channelId: channel.id })).statusCode).toBe(200);
    const again = await publish(offer.id, { channelId: channel.id });
    expect(again.statusCode).toBe(409);
    expect(code(again)).toBe('DUPLICATE');
    expect(await prisma.publication.count()).toBe(1);
  });

  it('sem channelId publica em todos os canais habilitados', async () => {
    await seedManualChannel('Fila A');
    await prisma.publishingChannel.create({ data: { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila B', enabled: true, config: {}, status: 'CONNECTED' } });
    await prisma.publishingChannel.create({ data: { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila C (desligada)', enabled: false, config: {}, status: 'DISABLED' } });
    const { offer } = await approved();
    const res = await publish(offer.id);
    expect(res.statusCode).toBe(200);
    expect(res.json().publications.map((p: { channelName: string }) => p.channelName).sort()).toEqual(['Fila A', 'Fila B']);
  });
});
