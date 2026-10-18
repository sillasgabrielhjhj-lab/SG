/**
 * Rotas /api/affiliate*: autenticação, CSRF, perfil somente leitura, contratos de resposta e regras
 * (nunca gera/altera URL de afiliado; nada validado sem confirmação; bloqueio de DELETE de link usado).
 * A resolução de redirecionamentos é desligada (resolveRedirects=false) onde o foco não é o destino do link:
 * os redirecionamentos têm testes próprios (tests/sim/affiliate-redirects).
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { GENERATION_UNAVAILABLE_REASON } from '../../src/routes/affiliate.js';
import { FORMAT_ONLY_NOTE } from '../../src/services/affiliate.js';
import { updateSettings } from '../../src/services/settings.js';
import { seedLinkFor, seedManualChannel, seedMlProduct, seedOfferFor } from '../helpers/affiliate-fixtures.js';
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
  await updateSettings({ affiliate: { resolveRedirects: false } });
});

const ID = 'MLB1000000001';

describe('/api/affiliate — autenticação, CSRF e perfil', () => {
  const routes: [string, string][] = [
    ['GET', '/api/affiliate/status'],
    ['GET', '/api/affiliate/links'],
    ['POST', '/api/affiliate/links'],
    ['POST', '/api/affiliate/links/import'],
    ['POST', '/api/affiliate/links/x/validate'],
    ['DELETE', '/api/affiliate/links/x'],
    ['GET', '/api/affiliate/pending'],
    ['GET', '/api/affiliate/pending.csv'],
  ];

  it.each(routes)('%s %s sem sessão => 401', async (method, url) => {
    const res = await app.inject({ method: method as 'GET', url });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it.each(routes.filter(([m]) => m !== 'GET'))('%s %s com sessão mas SEM token CSRF => 403 CSRF_INVALID', async (method, url) => {
    const res = await app.inject({ method: method as 'POST', url, headers: { cookie: agent.cookie }, payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_INVALID');
    const wrong = await app.inject({ method: method as 'POST', url, headers: { cookie: agent.cookie, 'x-csrf-token': 'token-errado' }, payload: {} });
    expect(wrong.statusCode).toBe(403);
  });

  it('perfil somente leitura (VIEWER) lê, mas não importa, cadastra, valida nem exclui', async () => {
    await createTestAdmin({ email: 'leitor@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'leitor@teste.local' });
    expect((await viewer.get('/api/affiliate/status')).statusCode).toBe(200);
    expect((await viewer.get('/api/affiliate/pending')).statusCode).toBe(200);
    for (const [method, url] of routes.filter(([m]) => m !== 'GET')) {
      const res = await viewer.request(method as 'POST', url, {});
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    }
  });
});

describe('/api/affiliate/status', () => {
  it('geração automática indisponível (honesto), credenciais e contagens reais', async () => {
    const empty = (await agent.get('/api/affiliate/status')).json();
    expect(empty).toEqual({ generation: { available: false, reason: GENERATION_UNAVAILABLE_REASON }, credentialsConfigured: false, counts: { pending: 0, validated: 0, invalid: 0 } });
    expect(empty.generation.reason).toMatch(/nunca cria nem altera URLs de afiliado/);

    const p = await seedMlProduct();
    await seedLinkFor(p.id, { status: 'VALIDATED' });
    await seedLinkFor(p.id, { status: 'PENDING' });
    await seedLinkFor(p.id, { status: 'PENDING' });
    await seedLinkFor(p.id, { status: 'INVALID' });
    await prisma.integrationCredential.create({ data: { provider: 'affiliate', name: 'Portal', encrypted: 'x', hint: '••••1234' } });
    const body = (await agent.get('/api/affiliate/status')).json();
    expect(body.counts).toEqual({ pending: 2, validated: 1, invalid: 1 });
    expect(body.credentialsConfigured).toBe(true);
    expect(body.generation.available).toBe(false);
  });
});

describe('GET /api/affiliate/links', () => {
  it('lista paginada com filtros (status em qualquer caixa, productId) e DTO do contrato', async () => {
    const a = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Produto A' });
    const b = await seedMlProduct({ externalId: 'MLB1000000002', title: 'Produto B' });
    const v = await seedLinkFor(a.id, { status: 'VALIDATED', url: 'https://meli.la/a' });
    await seedLinkFor(a.id, { status: 'PENDING', url: 'https://meli.la/b' });
    await seedLinkFor(b.id, { status: 'INVALID', url: 'https://meli.la/c' });

    const all = (await agent.get('/api/affiliate/links')).json();
    expect(all).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(Object.keys(all.items[0]).sort()).toEqual(['createdAt', 'id', 'kind', 'lastError', 'productId', 'productTitle', 'status', 'url', 'validatedAt', 'validationNote']);

    const validated = (await agent.get('/api/affiliate/links?status=validated')).json();
    expect(validated.items.map((l: { id: string }) => l.id)).toEqual([v.id]);
    expect(validated.items[0]).toMatchObject({ productTitle: 'Produto A', url: 'https://meli.la/a', status: 'VALIDATED' });
    expect(typeof validated.items[0].validatedAt).toBe('string');

    expect((await agent.get(`/api/affiliate/links?productId=${b.id}`)).json().total).toBe(1);
    expect((await agent.get('/api/affiliate/links?status=')).json().total).toBe(3); // vazio = sem filtro
    const page2 = (await agent.get('/api/affiliate/links?page=2&pageSize=2')).json();
    expect(page2).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
  });

  it('parâmetros inválidos => 400 no formato do contrato', async () => {
    for (const q of ['status=XYZ', 'page=0', 'pageSize=101', 'pageSize=abc']) {
      const res = await agent.get(`/api/affiliate/links?${q}`);
      expect(res.statusCode, q).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('POST /api/affiliate/links', () => {
  it('cadastra, valida (aqui: apenas por formato) e devolve o DTO — a URL fica exatamente como enviada', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const url = 'https://meli.la/2aBcDeF?matt_tool=1&utm_source=x';
    const res = await agent.post('/api/affiliate/links', { productId: p.id, url });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ productId: p.id, productTitle: p.title, url, kind: 'MANUAL', status: 'VALIDATED', validationNote: FORMAT_ONLY_NOTE, lastError: null });
    expect(await prisma.affiliateLink.count()).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'affiliate.link.add' } });
    expect(audit).toMatchObject({ entity: 'AffiliateLink', userId: agent.user.id });
    expect(audit.after).toMatchObject({ productId: p.id, status: 'VALIDATED' });
  });

  it('URL fora das regras (http, host desconhecido, id de outro produto) fica INVALID e nunca vira link utilizável', async () => {
    const p = await seedMlProduct({ externalId: ID });
    for (const url of ['http://meli.la/abc', 'https://encurtador-falso.example/abc', 'https://www.mercadolivre.com.br/MLB-1000000099-outro']) {
      const res = await agent.post('/api/affiliate/links', { productId: p.id, url });
      expect(res.statusCode, url).toBe(200);
      expect(res.json().status, url).toBe('INVALID');
      expect(res.json().validatedAt).toBeNull();
    }
    expect(await prisma.affiliateLink.count({ where: { status: 'VALIDATED' } })).toBe(0);
  });

  it('validação do corpo e produto inexistente', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const bad: unknown[] = [{}, { productId: p.id }, { url: 'https://meli.la/a' }, { productId: p.id, url: '   ' }, { productId: p.id, url: 'https://meli.la/a', extra: 1 }, { productId: 1, url: 'x' }];
    for (const body of bad) {
      const res = await agent.post('/api/affiliate/links', body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
    const missing = await agent.post('/api/affiliate/links', { productId: 'nao-existe', url: 'https://meli.la/a' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
    expect(await prisma.affiliateLink.count()).toBe(0);
  });
});

describe('POST /api/affiliate/links/import', () => {
  it('importa em lote ("URL_ML ; URL_AFILIADO", "MLB123 ; URL", CSV) e relata invalid/unmatched com o nº da linha', async () => {
    const p1 = await seedMlProduct({ externalId: 'MLB1000000001' });
    await seedMlProduct({ externalId: 'MLB1000000002' });
    const text = [
      'url_ml;url_afiliado',
      `${p1.permalink} ; https://meli.la/aaa`,
      'MLB1000000002,https://meli.la/bbb',
      'MLB9999999999;https://meli.la/ccc',
      'MLB1000000002;http://meli.la/inseguro',
      'linha sem nada util',
    ].join('\n');
    const res = await agent.post('/api/affiliate/links/import', { text });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ imported: 3, validated: 2, pending: 0, duplicates: 0 });
    expect(body.unmatched).toEqual([{ line: 4, reason: expect.stringContaining('MLB9999999999') }]);
    expect(body.invalid).toEqual([
      { line: 5, reason: expect.stringMatching(/https/i) },
      { line: 6, reason: expect.stringMatching(/sem URL de afiliado/i) },
    ]);
    const links = await prisma.affiliateLink.findMany({ orderBy: { url: 'asc' } });
    expect(links.map((l) => [l.url, l.status, l.kind, l.createdBy])).toEqual([
      ['http://meli.la/inseguro', 'INVALID', 'IMPORTED', agent.user.id],
      ['https://meli.la/aaa', 'VALIDATED', 'IMPORTED', agent.user.id],
      ['https://meli.la/bbb', 'VALIDATED', 'IMPORTED', agent.user.id],
    ]);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'affiliate.import' } });
    expect(audit.after).toEqual({ imported: 3, validated: 2, invalid: 2, unmatched: 1 });
  });

  it('reimportar o mesmo texto é idempotente (duplicados)', async () => {
    await seedMlProduct({ externalId: 'MLB1000000001' });
    const text = 'MLB1000000001;https://meli.la/aaa';
    await agent.post('/api/affiliate/links/import', { text });
    const again = (await agent.post('/api/affiliate/links/import', { text })).json();
    expect(again).toMatchObject({ imported: 0, duplicates: 1 });
    expect(await prisma.affiliateLink.count()).toBe(1);
  });

  it('corpo inválido: sem texto, vazio, campo extra, texto gigante; mais de 1000 linhas => 400', async () => {
    for (const body of [{}, { text: '' }, { text: 'x', outro: 1 }, { text: 'x'.repeat(1_000_001) }]) {
      const res = await agent.post('/api/affiliate/links/import', body);
      expect(res.statusCode).toBe(400);
    }
    const many = Array.from({ length: 1001 }, (_, i) => `MLB${i + 1};https://meli.la/${i}`).join('\n');
    const res = await agent.post('/api/affiliate/links/import', { text: many });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/1000 linhas/);
  });
});

describe('POST /api/affiliate/links/:id/validate e DELETE /api/affiliate/links/:id', () => {
  it('validate revalida o link e audita; 404 se não existe', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const link = await seedLinkFor(p.id, { status: 'PENDING', url: 'https://meli.la/aaa' });
    const res = await agent.post(`/api/affiliate/links/${link.id}/validate`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: link.id, status: 'VALIDATED', url: 'https://meli.la/aaa' });
    expect(await prisma.auditLog.count({ where: { action: 'affiliate.link.validate', entityId: link.id } })).toBe(1);

    expect((await agent.post('/api/affiliate/links/nao-existe/validate')).statusCode).toBe(404);
  });

  it('validate de link com host proibido => INVALID (a validação não depende da UI)', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const link = await seedLinkFor(p.id, { status: 'PENDING', url: 'https://phishing.example.com/MLB-1000000001' });
    const res = (await agent.post(`/api/affiliate/links/${link.id}/validate`)).json();
    expect(res.status).toBe('INVALID');
    expect(res.lastError).toMatch(/Host não permitido/);
  });

  it('DELETE remove link não usado', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const link = await seedLinkFor(p.id);
    const res = await agent.delete(`/api/affiliate/links/${link.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(await prisma.affiliateLink.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'affiliate.link.delete' } })).toBe(1);
  });

  it('DELETE de link já usado em publicação é BLOQUEADO (409 LINK_IN_USE) e o link permanece', async () => {
    const p = await seedMlProduct({ externalId: ID });
    const link = await seedLinkFor(p.id);
    const offer = await seedOfferFor(p.id, { status: 'PUBLISHED' });
    const channel = await seedManualChannel();
    await prisma.publication.create({
      data: { offerId: offer.id, channelId: channel.id, status: 'SENT', template: 'COMMON', messageText: 'x', affiliateLinkId: link.id, idempotencyKey: `${offer.id}:${channel.id}`, sentAt: new Date() },
    });
    const res = await agent.delete(`/api/affiliate/links/${link.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LINK_IN_USE');
    expect(await prisma.affiliateLink.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'affiliate.link.delete' } })).toBe(0);
    expect((await agent.delete('/api/affiliate/links/nao-existe')).statusCode).toBe(404);
  });
});

describe('GET /api/affiliate/pending e /pending.csv', () => {
  async function seedPending() {
    const best = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Fone JBL; "Tune" 520BT' });
    const other = await seedMlProduct({ externalId: 'MLB1000000002', title: 'Cafeteira Arno' });
    const done = await seedMlProduct({ externalId: 'MLB1000000003', title: 'Já com link' });
    await seedOfferFor(best.id, { status: 'APPROVED', score: 91 });
    await seedOfferFor(other.id, { status: 'DISCOVERED', score: 78 });
    await seedOfferFor(done.id, { status: 'APPROVED', score: 99 });
    await seedLinkFor(done.id, { status: 'VALIDATED' });
    return { best, other };
  }

  it('JSON: produtos qualificados/aprovados sem link validado, pela melhor pontuação', async () => {
    const { best, other } = await seedPending();
    const res = await agent.get('/api/affiliate/pending');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.map((r: { productId: string }) => r.productId)).toEqual([best.id, other.id]);
    expect(body[0]).toMatchObject({ title: 'Fone JBL; "Tune" 520BT', permalink: best.permalink, score: 91 });
    expect(typeof body[0].offerId).toBe('string');
  });

  it('CSV: id;titulo;url_ml;score, UTF-8 com BOM, anexo e células escapadas', async () => {
    const { best, other } = await seedPending();
    const res = await agent.get('/api/affiliate/pending.csv');
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/^text\/csv; charset=utf-8/);
    expect(String(res.headers['content-disposition'])).toBe('attachment; filename="links-pendentes.csv"');
    expect(res.body.startsWith('﻿id;titulo;url_ml;score\r\n')).toBe(true);
    const lines = res.body.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'id;titulo;url_ml;score',
      `${best.id};"Fone JBL; ""Tune"" 520BT";${best.permalink};91`,
      `${other.id};Cafeteira Arno;${other.permalink};78`,
    ]);
  });

  it('vazio: JSON [] e CSV só com cabeçalho (sem dados fictícios)', async () => {
    expect((await agent.get('/api/affiliate/pending')).json()).toEqual([]);
    expect((await agent.get('/api/affiliate/pending.csv')).body).toBe('﻿id;titulo;url_ml;score\r\n');
  });

  it('o ciclo fecha: importar o link tira o produto dos pendentes', async () => {
    const { best } = await seedPending();
    expect((await agent.get('/api/affiliate/pending')).json()).toHaveLength(2);
    const res = await agent.post('/api/affiliate/links/import', { text: `${best.id};https://meli.la/zzz` });
    expect(res.json()).toMatchObject({ imported: 1, validated: 1 });
    expect((await agent.get('/api/affiliate/pending')).json().map((r: { productId: string }) => r.productId)).not.toContain(best.id);
  });
});
