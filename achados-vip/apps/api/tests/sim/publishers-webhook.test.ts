/**
 * Webhook autorizado (Modo C) contra servidores HTTP SIMULADOS em localhost: sucesso, assinatura HMAC verificável,
 * 401/403 (authRequired), 429 (Retry-After), 5xx, redirecionamento não seguido, falha de rede e proteção SSRF
 * (IP privado/localhost/metadata recusados sem sequer abrir conexão).
 */
import { createHmac } from 'node:crypto';
import net from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SendResult } from '../../src/domain/types.js';
import { MAX_RETRY_AFTER_MS } from '../../src/adapters/publishers/common.js';
import { SIGNATURE_HEADER, IDEMPOTENCY_HEADER, WEBHOOK_EVENT, WebhookPublisher, signWebhookBody } from '../../src/adapters/publishers/webhook.js';
import { hmacSign, hmacVerify } from '../../src/lib/crypto.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { WH_SECRET, leaks, reply, startSim, type SimHandler, type SimServer } from '../helpers/publishing-fixtures.js';

const KEY = 'offer-77:chan-9';
const FIXED = new Date('2026-10-01T15:00:00.000Z');
let sim: SimServer | null = null;
beforeAll(() => setSsrfAllowPrivateForTests(true));
afterAll(() => setSsrfAllowPrivateForTests(false));
afterEach(async () => {
  await sim?.close();
  sim = null;
});

async function setup(handler: SimHandler, secret = WH_SECRET) {
  sim = await startSim(handler);
  return { sim, pub: new WebhookPublisher({ url: `${sim.url}/hook?src=achados`, secret, now: () => FIXED }) };
}
const clean = (r: SendResult) => expect(leaks(r)).toEqual([]);

describe('Webhook (sim): envio e confirmação', () => {
  it('2xx => confirmado; corpo JSON com evento, publicação, texto, imagem, chave de idempotência e sentAt', async () => {
    const { pub, sim } = await setup((_h, res) => reply(res, 200, { id: 'recv-123' }));
    const r = await pub.send({ text: 'Oferta https://meli.la/a', imageUrl: 'https://http2.mlstatic.com/a.jpg', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: 'recv-123', httpStatus: 200 });
    expect(sim.hits).toHaveLength(1);
    const hit = sim.hits[0]!;
    expect(hit.method).toBe('POST');
    expect(hit.url).toBe('/hook?src=achados');
    expect(hit.headers['content-type']).toBe('application/json');
    expect(hit.json()).toEqual({
      event: WEBHOOK_EVENT,
      publication: { offerId: 'offer-77', channelId: 'chan-9', idempotencyKey: KEY },
      text: 'Oferta https://meli.la/a',
      imageUrl: 'https://http2.mlstatic.com/a.jpg',
      idempotencyKey: KEY,
      sentAt: FIXED.toISOString(),
    });
    expect(hit.headers[IDEMPOTENCY_HEADER]).toBe(KEY);
  });

  it('imageUrl ausente vira null; resposta 2xx sem id (200 vazio / 204) é aceita pelo receptor (confirmada, sem id externo)', async () => {
    for (const status of [200, 201, 202, 204]) {
      const { pub, sim } = await setup((_h, res) => reply(res, status));
      const r = await pub.send({ text: 'oi', idempotencyKey: KEY });
      expect(r, `HTTP ${status}`).toMatchObject({ ok: true, confirmed: true, httpStatus: status });
      expect(r.externalMessageId).toBeUndefined();
      expect(sim.hits[0]!.json().imageUrl).toBeNull();
      await sim.close();
    }
  });

  it('id numérico no JSON de resposta vira externalMessageId (string)', async () => {
    const { pub } = await setup((_h, res) => reply(res, 200, { id: 99 }));
    expect((await pub.send({ text: 'oi', idempotencyKey: KEY })).externalMessageId).toBe('99');
  });
});

describe('Webhook (sim): assinatura HMAC-SHA256 verificável', () => {
  it('X-Signature = sha256=<hex do HMAC do CORPO BRUTO com o segredo do canal>; o receptor consegue verificar', async () => {
    const { pub, sim } = await setup((_h, res) => reply(res, 200, {}));
    await pub.send({ text: 'Oferta ção & <b>', idempotencyKey: KEY });
    const hit = sim.hits[0]!;
    const header = String(hit.headers[SIGNATURE_HEADER]);
    expect(header).toMatch(/^sha256=[0-9a-f]{64}$/);
    // verificação independente (receptor): HMAC calculado com node:crypto sobre os bytes recebidos
    const expected = createHmac('sha256', WH_SECRET).update(hit.body).digest('hex');
    expect(header).toBe(`sha256=${expected}`);
    expect(hmacVerify(hit.body, WH_SECRET, header.slice(7))).toBe(true);
    expect(header).toBe(signWebhookBody(hit.body, WH_SECRET));
  });

  it('adulterar o corpo, errar o segredo ou o prefixo invalida a assinatura', async () => {
    const { pub, sim } = await setup((_h, res) => reply(res, 200, {}));
    await pub.send({ text: 'preço R$ 100,00', idempotencyKey: KEY });
    const hit = sim.hits[0]!;
    const sig = String(hit.headers[SIGNATURE_HEADER]).slice(7);
    expect(hmacVerify(hit.body.replace('100,00', '1,00'), WH_SECRET, sig)).toBe(false);
    expect(hmacVerify(hit.body, `${WH_SECRET}x`, sig)).toBe(false);
    expect(hmacVerify(hit.body, WH_SECRET, `sha256=${sig}`)).toBe(false);
    expect(hmacVerify(hit.body, WH_SECRET, '')).toBe(false);
  });

  it('segredos diferentes geram assinaturas diferentes; mesmo payload e relógio => mesma assinatura (determinística)', async () => {
    const a = await setup((_h, res) => reply(res, 200, {}), WH_SECRET);
    await a.pub.send({ text: 'x', idempotencyKey: KEY });
    await a.pub.send({ text: 'x', idempotencyKey: KEY });
    const sigs = a.sim.hits.map((h) => h.headers[SIGNATURE_HEADER]);
    expect(sigs[0]).toBe(sigs[1]);
    await sim?.close();
    const b = await setup((_h, res) => reply(res, 200, {}), `${WH_SECRET}-outro`);
    await b.pub.send({ text: 'x', idempotencyKey: KEY });
    expect(b.sim.hits[0]!.headers[SIGNATURE_HEADER]).not.toBe(sigs[0]);
    expect(hmacSign(b.sim.hits[0]!.body, `${WH_SECRET}-outro`)).toBe(String(b.sim.hits[0]!.headers[SIGNATURE_HEADER]).slice(7));
  });

  it('o segredo nunca viaja no corpo, em cabeçalhos nem na URL', async () => {
    const { pub, sim } = await setup((_h, res) => reply(res, 200, {}));
    await pub.send({ text: 'x', idempotencyKey: KEY });
    const hit = sim.hits[0]!;
    expect(hit.body).not.toContain(WH_SECRET);
    expect(hit.url).not.toContain(WH_SECRET);
    expect(JSON.stringify(hit.headers)).not.toContain(WH_SECRET);
  });
});

describe('Webhook (sim): erros', () => {
  it.each([401, 403])('HTTP %s (receptor recusou a assinatura) => authRequired + permanent', async (status) => {
    const { pub } = await setup((_h, res) => reply(res, status, 'assinatura inválida'));
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status, authRequired: true, permanent: true });
    expect(r.error).toContain(`HTTP ${status}`);
  });

  it('429 com Retry-After => retryAfterMs; sem cabeçalho => sem retryAfterMs; absurdo => limitado a 6h; 1 só chamada', async () => {
    const a = await setup((_h, res) => reply(res, 429, 'devagar', { 'retry-after': '120' }));
    expect(await a.pub.send({ text: 'x', idempotencyKey: KEY })).toMatchObject({ ok: false, httpStatus: 429, retryAfterMs: 120_000 });
    expect(a.sim.hits).toHaveLength(1);
    await sim?.close();
    const b = await setup((_h, res) => reply(res, 429, 'devagar'));
    const r = await b.pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r.retryAfterMs).toBeUndefined();
    expect(r.permanent).toBeFalsy();
    await sim?.close();
    const c = await setup((_h, res) => reply(res, 429, 'devagar', { 'retry-after': '99999999' }));
    expect((await c.pub.send({ text: 'x', idempotencyKey: KEY })).retryAfterMs).toBe(MAX_RETRY_AFTER_MS);
  });

  it.each([408, 425, 500, 502, 503, 504])('HTTP %s => retentável', async (status) => {
    const { pub, sim } = await setup((_h, res) => reply(res, status, 'indisponível'));
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(sim.hits).toHaveLength(1); // sem retentativa interna
  });

  it.each([400, 404, 410, 422])('HTTP %s => permanente (URL/payload não serve), sem authRequired', async (status) => {
    const { pub } = await setup((_h, res) => reply(res, status, 'não'));
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status, permanent: true });
    expect(r.authRequired).toBeFalsy();
  });

  it.each([301, 302, 307, 308])('redirecionamento %s NÃO é seguido (o corpo assinado não vai para outro destino)', async (status) => {
    const target = await startSim((_h, res) => reply(res, 200, { id: 'x' }));
    try {
      const { pub } = await setup((_h, res) => reply(res, status, '', { location: `${target.url}/destino` }));
      const r = await pub.send({ text: 'x', idempotencyKey: KEY });
      expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status, permanent: true });
      expect(r.error).toMatch(/redirecionamento/);
      expect(target.hits).toHaveLength(0);
    } finally {
      await target.close();
    }
  });

  it('falha de rede (conexão recusada) => retentável', async () => {
    const dead = await startSim((_h, res) => reply(res, 200));
    const url = dead.url;
    await dead.close();
    const r = await new WebhookPublisher({ url: `${url}/hook`, secret: WH_SECRET }).send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.error).toMatch(/Falha de rede/);
  });

  it('o corpo de erro do receptor é limitado e sanitizado (nada de token/segredo conhecido por padrão)', async () => {
    const big = `Bearer EAAGm0PX4ZCpsBAKtestTOKENabcdefghijklmnop12345 token=abc123456 ${'z'.repeat(5000)}`;
    const { pub } = await setup((_h, res) => reply(res, 500, big));
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r.error!.length).toBeLessThan(400);
    expect(r.error).toContain('[REDACTED]');
    expect(r.error).not.toContain('EAAGm0PX4ZCps');
    clean(r);
  });
});

describe('Webhook (sim): proteção SSRF (sem allowPrivate) — IP privado/localhost recusados sem conectar', () => {
  beforeEach(() => setSsrfAllowPrivateForTests(false));
  afterEach(() => setSsrfAllowPrivateForTests(true));

  it('o servidor local simulado recebe ZERO requisições quando o destino é loopback', async () => {
    sim = await startSim((_h, res) => reply(res, 200, { id: 'x' }));
    let connections = 0;
    sim.server.on('connection', () => connections++);
    const pub = new WebhookPublisher({ url: `${sim.url}/hook`, secret: WH_SECRET });
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, permanent: true });
    expect(r.error).toMatch(/proteção SSRF/);
    expect(sim.hits).toHaveLength(0);
    expect(connections).toBe(0);
  });

  it.each([
    ['localhost', 'http://localhost:8080/hook'],
    ['subdomínio de localhost', 'http://api.localhost/hook'],
    ['loopback IPv4', 'http://127.0.0.1/hook'],
    ['loopback decimal', 'http://2130706433/hook'],
    ['loopback hex', 'http://0x7f.1/hook'],
    ['loopback IPv6', 'http://[::1]:3000/hook'],
    ['IPv4 mapeado em IPv6', 'http://[::ffff:127.0.0.1]/hook'],
    ['0.0.0.0', 'http://0.0.0.0/hook'],
    ['rede 10/8', 'http://10.0.0.5/hook'],
    ['rede 172.16/12', 'http://172.16.4.2/hook'],
    ['rede 192.168/16', 'https://192.168.1.10/hook'],
    ['CGNAT 100.64/10', 'http://100.64.0.1/hook'],
    ['metadata de nuvem (link-local)', 'http://169.254.169.254/latest/meta-data/'],
    ['host .internal', 'https://metadata.google.internal/computeMetadata/v1/'],
    ['host .local', 'https://impressora.local/hook'],
    ['credenciais embutidas', 'https://user:senha@hooks.exemplo.com/x'],
    ['esquema ftp', 'ftp://hooks.exemplo.com/x'],
    ['esquema file', 'file:///etc/passwd'],
  ])('%s => recusado (SSRF) e não retentável', async (_label, url) => {
    const r = await new WebhookPublisher({ url, secret: WH_SECRET }).send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, permanent: true });
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/proteção SSRF/);
  });

  it('teste de conexão também recusa destinos internos (ERROR, sem HEAD)', async () => {
    sim = await startSim((_h, res) => reply(res, 200));
    const h = await new WebhookPublisher({ url: `${sim.url}/hook`, secret: WH_SECRET }).healthCheck();
    expect(h).toMatchObject({ ok: false, status: 'ERROR' });
    expect(h.detail).toMatch(/SSRF/);
    expect(sim.hits).toHaveLength(0);
    const meta = await new WebhookPublisher({ url: 'http://169.254.169.254/', secret: WH_SECRET }).healthCheck();
    expect(meta).toMatchObject({ ok: false, status: 'ERROR' });
  });

  it('nenhum socket é aberto para um IP privado literal (porta fechada: bloqueio vem ANTES de conectar)', async () => {
    // se tentasse conectar, o erro seria ECONNREFUSED ("Falha de rede"), não SSRF
    const closed = await new Promise<number>((resolve) => {
      const s = net.createServer().listen(0, '127.0.0.1', () => {
        const port = (s.address() as net.AddressInfo).port;
        s.close(() => resolve(port));
      });
    });
    const r = await new WebhookPublisher({ url: `http://127.0.0.1:${closed}/hook`, secret: WH_SECRET }).send({ text: 'x', idempotencyKey: KEY });
    expect(r.error).toMatch(/proteção SSRF/);
    expect(r.error).not.toMatch(/Falha de rede/);
  });
});

describe('Webhook (sim): teste de conexão', () => {
  it('HEAD respondido (qualquer status) => CONNECTED com a ressalva do primeiro envio', async () => {
    for (const status of [200, 405]) {
      const { pub, sim } = await setup((_h, res) => reply(res, status));
      const h = await pub.healthCheck();
      expect(h).toMatchObject({ ok: true, status: 'CONNECTED' });
      expect(h.detail).toMatch(/primeiro envio/);
      expect(sim.hits[0]!.method).toBe('HEAD');
      await sim.close();
    }
  });

  it('sem conexão => ERROR', async () => {
    const dead = await startSim((_h, res) => reply(res, 200));
    const url = dead.url;
    await dead.close();
    expect(await new WebhookPublisher({ url: `${url}/hook`, secret: WH_SECRET }).healthCheck()).toMatchObject({ ok: false, status: 'ERROR' });
  });
});
