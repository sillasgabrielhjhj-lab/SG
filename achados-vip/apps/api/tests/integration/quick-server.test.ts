import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildQuickServer } from '../../src/quick-server.js';

const PASSWORD = 'senha-de-teste-123';
const H = { 'x-requested-with': 'fetch', 'content-type': 'application/json' };
let app: FastifyInstance;
let nowMs = 1_000_000;

beforeAll(() => {
  app = buildQuickServer({ password: PASSWORD, secret: 'x'.repeat(40), now: () => nowMs });
});
afterAll(async () => {
  await app.close();
});

async function login(pw = PASSWORD, ip = '10.0.0.1') {
  return app.inject({ method: 'POST', url: '/login', headers: H, payload: { password: pw }, remoteAddress: ip });
}
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0]!;

describe('quick-server', () => {
  it('recusa configuração fraca', () => {
    expect(() => buildQuickServer({ password: 'curta', secret: 'x'.repeat(40) })).toThrow();
    expect(() => buildQuickServer({ password: PASSWORD, secret: 'curto' })).toThrow();
  });

  it('serve a página, script e css sem login; rotas de dados exigem login', async () => {
    expect((await app.inject({ url: '/' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/app.js' })).headers['content-type']).toContain('javascript');
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/preview', headers: H, payload: { url: 'https://meli.la/x' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/image?url=https://http2.mlstatic.com/a.png' })).statusCode).toBe(401);
  });

  it('login: senha errada 401; certa define cookie HttpOnly/SameSite=Strict e libera /me', async () => {
    expect((await login('errada-errada')).statusCode).toBe(401);
    const ok = await login();
    expect(ok.statusCode).toBe(200);
    const sc = String(ok.headers['set-cookie']);
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Strict');
    expect((await app.inject({ url: '/me', headers: { cookie: cookieOf(ok) } })).statusCode).toBe(200);
  });

  it('cookie adulterado ou expirado é recusado', async () => {
    const c = cookieOf(await login());
    expect((await app.inject({ url: '/me', headers: { cookie: c + 'x' } })).statusCode).toBe(401);
    nowMs += 13 * 60 * 60 * 1000;
    expect((await app.inject({ url: '/me', headers: { cookie: c } })).statusCode).toBe(401);
  });

  it('POST sem o cabeçalho anti-CSRF é recusado (403)', async () => {
    const r = await app.inject({ method: 'POST', url: '/login', headers: { 'content-type': 'application/json' }, payload: { password: PASSWORD } });
    expect(r.statusCode).toBe(403);
  });

  it('gera o texto com o link exato (campos manuais, sem rede) e recusa host de fora do ML', async () => {
    const c = cookieOf(await login());
    const ok = await app.inject({
      method: 'POST', url: '/preview', headers: { ...H, cookie: c },
      payload: { url: 'https://meli.la/2aBcDeF', title: 'Fone Bluetooth TWS', price: '49,90', originalPrice: '99,90', imageUrl: 'https://http2.mlstatic.com/fone.png' },
    });
    const b = ok.json();
    expect(b.ok).toBe(true);
    expect(b.whatsapp).toContain('https://meli.la/2aBcDeF');
    expect(b.whatsapp).toContain('50% OFF');
    expect(b.imageUrl).toBe('https://http2.mlstatic.com/fone.png');
    const bad = await app.inject({ method: 'POST', url: '/preview', headers: { ...H, cookie: c }, payload: { url: 'https://evil.example.com/x', title: 'a b c', price: 10 } });
    expect(bad.statusCode).toBe(400);
    const img = await app.inject({ url: '/image?url=' + encodeURIComponent('https://evil.example.com/i.png'), headers: { cookie: c } });
    expect(img.statusCode).toBe(400);
  });

  it('limita tentativas de login por IP (429 após 5 falhas) sem afetar outro IP', async () => {
    for (let i = 0; i < 5; i++) expect((await login('errada-errada', '10.0.0.9')).statusCode).toBe(401);
    expect((await login(PASSWORD, '10.0.0.9')).statusCode).toBe(429);
    expect((await login(PASSWORD, '10.0.0.10')).statusCode).toBe(200);
  });

  it('cabeçalhos de segurança presentes', async () => {
    const r = await app.inject({ url: '/' });
    expect(String(r.headers['content-security-policy'])).toContain("script-src 'self'");
    expect(r.headers['x-frame-options']).toBe('DENY');
  });
});
