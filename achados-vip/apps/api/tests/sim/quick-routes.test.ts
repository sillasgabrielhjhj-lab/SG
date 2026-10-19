/**
 * SIMULADO: /api/quick/preview e /api/quick/image com o safeFetch REAL sobre "hosts virtuais" (meli.la,
 * produto.mercadolivre.com.br, http2.mlstatic.com) servidos por um servidor local. Nenhuma requisição à internet.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { quickDeps } from '../../src/services/quick-fetch.js';
import { fakePublicResolver } from '../helpers/affiliate-fixtures.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';
import { startSimServer, type SimServer } from '../helpers/sim-server.js';
import { clearVirtualHosts, routeVirtualHosts } from '../helpers/sim-virtual-hosts.js';

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  const { wrapUndiciRequest } = await import('../helpers/sim-virtual-hosts.js');
  return { ...actual, request: wrapUndiciRequest(actual.request) };
});

const HOSTS = ['meli.la', 'produto.mercadolivre.com.br', 'http2.mlstatic.com', 'evil.example.com'];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const ld = (o: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(o)}</script></head></html>`;

let server: SimServer;
let app: FastifyInstance;
let agent: TestAgent;

beforeAll(async () => {
  quickDeps.resolver = fakePublicResolver;
  app = await buildTestApp();
  server = await startSimServer((req, res) => {
    const host = String(req.headers.host ?? '');
    const send = (status: number, headers: Record<string, string>, body: string | Buffer = '') => {
      res.writeHead(status, headers);
      res.end(body);
    };
    if (host === 'meli.la') {
      if (req.path === '/ok') return send(302, { location: 'https://produto.mercadolivre.com.br/MLB-1-fone' });
      if (req.path === '/sempreco') return send(302, { location: 'https://produto.mercadolivre.com.br/MLB-2-sem-preco' });
      if (req.path === '/fora') return send(503, { 'content-type': 'text/html' }, 'manutenção');
    }
    if (host === 'produto.mercadolivre.com.br') {
      if (req.path.startsWith('/MLB-1')) {
        return send(200, { 'content-type': 'text/html' }, ld({ '@type': 'Product', name: 'Fone Bluetooth TWS | Mercado Livre', image: 'https://http2.mlstatic.com/fone.png', offers: { price: 49.9, priceCurrency: 'BRL' } }));
      }
      return send(200, { 'content-type': 'text/html' }, ld({ '@type': 'Product', name: 'Produto sem preço visível' }));
    }
    if (host === 'http2.mlstatic.com') {
      if (req.path === '/fone.png') return send(200, { 'content-type': 'image/png' }, PNG);
      return send(200, { 'content-type': 'text/html' }, '<html>não é imagem</html>');
    }
    return send(404, {});
  });
  routeVirtualHosts(HOSTS, server.port);
});
afterAll(async () => {
  clearVirtualHosts();
  quickDeps.resolver = undefined as never;
  await server.close();
  await app.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await createTestAdmin();
  agent = await loginAgent(app);
});

describe('sim: POST /api/quick/preview', () => {
  it('lê título, preço e imagem pela página e gera o texto com o link EXATO do admin', async () => {
    const r = await agent.post('/api/quick/preview', { url: 'https://meli.la/ok' });
    const b = r.json();
    expect(r.statusCode).toBe(200);
    expect(b.ok).toBe(true);
    expect(b.title).toBe('Fone Bluetooth TWS');
    expect(b.priceCents).toBe(4990);
    expect(b.imageUrl).toBe('https://http2.mlstatic.com/fone.png');
    expect(b.whatsapp).toContain('R$ 49,90');
    expect(b.whatsapp).toContain('https://meli.la/ok');
    expect(b.whatsapp).not.toMatch(/De:|OFF/); // sem preço original informado: nada inventado
  });

  it('valores digitados pelo admin prevalecem; preço original gera De/Por', async () => {
    const r = await agent.post('/api/quick/preview', { url: 'https://meli.la/ok', price: '39,90', originalPrice: '79,80', title: 'Meu título' });
    const b = r.json();
    expect(b.priceCents).toBe(3990);
    expect(b.title).toBe('Meu título');
    expect(b.whatsapp).toContain('50% OFF');
  });

  it('página sem preço: pede o preço (needsInput) e não inventa texto; depois do preço manual, gera', async () => {
    const r1 = (await agent.post('/api/quick/preview', { url: 'https://meli.la/sempreco' })).json();
    expect(r1.ok).toBe(false);
    expect(r1.needsInput).toEqual(['price']);
    expect(r1.whatsapp).toBeNull();
    const r2 = (await agent.post('/api/quick/preview', { url: 'https://meli.la/sempreco', price: '120' })).json();
    expect(r2.ok).toBe(true);
    expect(r2.whatsapp).toContain('R$ 120,00');
  });

  it('página fora do ar: avisa e permite preencher manualmente', async () => {
    const r = (await agent.post('/api/quick/preview', { url: 'https://meli.la/fora' })).json();
    expect(r.ok).toBe(false);
    expect(r.needsInput).toEqual(['title', 'price']);
    expect(r.warnings.join(' ')).toContain('HTTP 503');
    const ok = (await agent.post('/api/quick/preview', { url: 'https://meli.la/fora', title: 'Produto X', price: 10 })).json();
    expect(ok.ok).toBe(true);
  });

  it('recusa host que não é do Mercado Livre, preço inválido e imagem de outro site', async () => {
    expect((await agent.post('/api/quick/preview', { url: 'https://evil.example.com/x' })).statusCode).toBe(400);
    expect((await agent.post('/api/quick/preview', { url: 'https://meli.la/ok', price: 'abc' })).statusCode).toBe(400);
    const r = (await agent.post('/api/quick/preview', { url: 'https://meli.la/ok', imageUrl: 'https://evil.example.com/i.png' })).json();
    expect(r.imageUrl).toBeNull();
    expect(r.warnings.join(' ')).toContain('ignorada');
  });

  it('exige login', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/quick/preview', payload: { url: 'https://meli.la/ok' } });
    expect(r.statusCode).toBe(401);
  });
});

describe('sim: GET /api/quick/image', () => {
  it('serve a imagem do CDN do ML e permite download', async () => {
    const r = await agent.get('/api/quick/image?url=' + encodeURIComponent('https://http2.mlstatic.com/fone.png') + '&download=1');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(String(r.headers['content-disposition'])).toContain('attachment');
    expect(Buffer.from(r.rawPayload).equals(PNG)).toBe(true);
  });
  it('recusa host de fora do CDN e conteúdo que não é imagem', async () => {
    expect((await agent.get('/api/quick/image?url=' + encodeURIComponent('https://evil.example.com/i.png'))).statusCode).toBe(400);
    expect((await agent.get('/api/quick/image?url=' + encodeURIComponent('https://http2.mlstatic.com/pagina'))).statusCode).toBe(502);
  });
});
