/**
 * WhatsApp Business Platform — Groups API (Modo A) contra um servidor HTTP SIMULADO em localhost.
 * Nenhuma chamada real à Meta: nomes de campos/códigos seguem o que o adaptador documenta como "a validar".
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SendResult } from '../../src/domain/types.js';
import { MAX_RETRY_AFTER_MS } from '../../src/adapters/publishers/common.js';
import { WHATSAPP_CAPTION_LIMIT, WHATSAPP_TEXT_LIMIT, WhatsAppCloudGroupPublisher } from '../../src/adapters/publishers/whatsapp-cloud.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { WA_TOKEN, leaks, reply, startSim, type SimHandler, type SimServer } from '../helpers/publishing-fixtures.js';

beforeAll(() => setSsrfAllowPrivateForTests(true));
afterAll(() => setSsrfAllowPrivateForTests(false));

const IMG = 'https://http2.mlstatic.com/D_NQ_NP_2.jpg';
const KEY = 'offer-1:chan-1';
let sim: SimServer | null = null;
afterEach(async () => {
  await sim?.close();
  sim = null;
});

async function setup(handler: SimHandler, extra: { apiVersion?: string; trailingSlash?: boolean } = {}) {
  sim = await startSim(handler);
  const pub = new WhatsAppCloudGroupPublisher({
    accessToken: WA_TOKEN,
    phoneNumberId: '1234567890',
    groupId: 'grupo-teste-1',
    baseUrl: extra.trailingSlash ? `${sim.url}/` : sim.url,
    ...(extra.apiVersion ? { apiVersion: extra.apiVersion } : {}),
  });
  return { pub, sim };
}
const ok = (id = 'wamid.HBgM'): SimHandler => (_h, res) => reply(res, 200, { messaging_product: 'whatsapp', messages: [{ id }] });
const metaError = (status: number, code: number, message = 'erro', headers: Record<string, string> = {}): SimHandler => (_h, res) =>
  reply(res, status, { error: { message, type: 'OAuthException', code, fbtrace_id: 'abc' } }, headers);
const clean = (r: SendResult) => expect(leaks(r)).toEqual([]);

describe('WhatsApp Cloud Groups (sim): envio e confirmação', () => {
  it('texto => POST /v23.0/<phoneNumberId>/messages com recipient_type=group, token só no header Authorization', async () => {
    const { pub, sim } = await setup(ok());
    const r = await pub.send({ text: '*Oferta* https://meli.la/2aBcDeF', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: 'wamid.HBgM', httpStatus: 200 });
    expect(sim.hits).toHaveLength(1);
    const hit = sim.hits[0]!;
    expect(hit.method).toBe('POST');
    expect(hit.url).toBe('/v23.0/1234567890/messages');
    expect(hit.headers.authorization).toBe(`Bearer ${WA_TOKEN}`);
    expect(hit.headers['content-type']).toMatch(/application\/json/);
    expect(hit.json()).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'group',
      to: 'grupo-teste-1',
      type: 'text',
      text: { body: '*Oferta* https://meli.la/2aBcDeF', preview_url: true },
    });
    expect(hit.body).not.toContain(WA_TOKEN);
    expect(hit.url).not.toContain(WA_TOKEN);
    clean(r);
  });

  it('apiVersion configurável e barra final na baseUrl é ignorada', async () => {
    const { pub, sim } = await setup(ok(), { apiVersion: 'v21.0', trailingSlash: true });
    await pub.send({ text: 'oi', idempotencyKey: KEY });
    expect(sim.hits[0]!.url).toBe('/v21.0/1234567890/messages');
  });

  it('imagem https + legenda <= 1024 => type=image com caption; 1025 => texto com pré-visualização', async () => {
    const { pub, sim } = await setup(ok());
    expect(WHATSAPP_CAPTION_LIMIT).toBe(1024);
    await pub.send({ text: 'a'.repeat(1024), imageUrl: IMG, idempotencyKey: KEY });
    await pub.send({ text: 'a'.repeat(1025), imageUrl: IMG, idempotencyKey: KEY });
    const [first, second] = sim.hits.map((h) => h.json());
    expect(first).toMatchObject({ type: 'image', image: { link: IMG } });
    expect(first.image.caption).toHaveLength(1024);
    expect(second).toMatchObject({ type: 'text', text: { preview_url: true } });
    expect(second.text.body).toHaveLength(1025);
    expect(second.image).toBeUndefined();
  });

  it('imagem http ou ausente => texto', async () => {
    const { pub, sim } = await setup(ok());
    await pub.send({ text: 'oi', imageUrl: 'http://exemplo.com/a.jpg', idempotencyKey: KEY });
    await pub.send({ text: 'oi', imageUrl: null, idempotencyKey: KEY });
    expect(sim.hits.map((h) => h.json().type)).toEqual(['text', 'text']);
  });

  it('texto vazio ou > 4096 => permanente sem chamar a Meta', async () => {
    const { pub, sim } = await setup(ok());
    expect(WHATSAPP_TEXT_LIMIT).toBe(4096);
    for (const text of ['', '   ', 'a'.repeat(4097)]) {
      expect(await pub.send({ text, idempotencyKey: KEY })).toMatchObject({ ok: false, confirmed: false, permanent: true });
    }
    expect(sim.hits).toHaveLength(0);
  });
});

describe('WhatsApp Cloud Groups (sim): resposta sem id NÃO é confirmação', () => {
  const bodies: [string, string | object][] = [
    ['messages vazio', { messaging_product: 'whatsapp', messages: [] }],
    ['sem messages', { messaging_product: 'whatsapp' }],
    ['messages[0] sem id', { messages: [{}] }],
    ['id vazio', { messages: [{ id: '' }] }],
    ['id numérico', { messages: [{ id: 123 }] }],
    ['corpo não-JSON', 'OK'],
    ['corpo vazio', ''],
  ];
  it.each(bodies)('2xx com %s => ok=false, confirmed=false (retentável)', async (_label, body) => {
    const { pub } = await setup((_h, res) => reply(res, 200, body));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 200 });
    expect(r.externalMessageId).toBeUndefined();
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/NÃO confirmado/);
  });
});

describe('WhatsApp Cloud Groups (sim): erros', () => {
  it.each([
    ['HTTP 401', 401, 190],
    ['HTTP 403', 403, 200],
    ['HTTP 400 com código 190 (token expirado)', 400, 190],
    ['HTTP 400 com código 102 (sessão inválida)', 400, 102],
    ['HTTP 400 com código 10 (permissão)', 400, 10],
    ['HTTP 400 com código 200 (permissão)', 400, 200],
  ])('%s => authRequired + permanent (pausa o canal)', async (_label, status, code) => {
    const { pub } = await setup(metaError(status, code, 'Invalid OAuth access token'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status, authRequired: true, permanent: true });
    expect(r.error).toContain(`WhatsApp ${status}`);
    clean(r);
  });

  it('429 com Retry-After => retryAfterMs; retentável (não permanente, não auth); 1 só chamada', async () => {
    const { pub, sim } = await setup(metaError(429, 4, 'Application request limit reached', { 'retry-after': '30' }));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 429, retryAfterMs: 30_000 });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(sim.hits).toHaveLength(1);
  });

  it('429 sem Retry-After => retentável sem retryAfterMs; Retry-After absurdo é limitado a 6h', async () => {
    const a = await setup(metaError(429, 130429));
    const r = await a.pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ httpStatus: 429 });
    expect(r.retryAfterMs).toBeUndefined();
    expect(r.permanent).toBeFalsy();
    await sim?.close();
    const b = await setup(metaError(429, 4, 'x', { 'retry-after': '999999' }));
    expect((await b.pub.send({ text: 'x', idempotencyKey: KEY })).retryAfterMs).toBe(MAX_RETRY_AFTER_MS);
  });

  it.each([4, 17, 32, 613, 80007, 130429, 131048, 131056])('HTTP 400 com código de limite de taxa %s => retentável (não permanente)', async (code) => {
    const { pub } = await setup(metaError(400, code, 'Rate limit'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 400 });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
  });

  it.each([500, 502, 503])('HTTP %s => retentável, sem retentativa interna', async (status) => {
    const { pub, sim } = await setup(metaError(status, 1, 'Unexpected'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(sim.hits).toHaveLength(1);
  });

  it('demais 4xx (payload/política rejeitada) => permanente, sem authRequired', async () => {
    const { pub } = await setup(metaError(400, 131009, 'Parameter value is not valid'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 400, permanent: true });
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/código 131009/);
  });

  it('falha de rede => retentável', async () => {
    const dead = await startSim(ok());
    const url = dead.url;
    await dead.close();
    const pub = new WhatsAppCloudGroupPublisher({ accessToken: WA_TOKEN, phoneNumberId: '1234567890', groupId: 'g', baseUrl: url });
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.error).toMatch(/Falha de rede/);
    clean(r);
  });
});

describe('WhatsApp Cloud Groups (sim): o token nunca aparece em erros/respostas', () => {
  it('erro da Meta que ecoa o token (Bearer / access_token= / EAA...) sai sanitizado de error e response', async () => {
    const handler: SimHandler = (_h, res) =>
      reply(res, 401, { error: { message: `Invalid OAuth access token. Authorization: Bearer ${WA_TOKEN}; url ?access_token=${WA_TOKEN}; raw ${WA_TOKEN}`, code: 190, access_token: WA_TOKEN } });
    const { pub } = await setup(handler);
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r.authRequired).toBe(true);
    expect(r.error).toContain('[REDACTED]');
    clean(r);
    expect(JSON.stringify(r.response)).not.toContain(WA_TOKEN);
  });

  it('respostas 2xx sem id também não carregam o token (campos sensíveis viram [REDACTED])', async () => {
    const { pub } = await setup((_h, res) => reply(res, 200, { messages: [], access_token: WA_TOKEN, debug: `Bearer ${WA_TOKEN}` }));
    clean(await pub.send({ text: 'x', idempotencyKey: KEY }));
  });
});

describe('WhatsApp Cloud Groups (sim): teste de conexão', () => {
  const route = (phone: [number, unknown], group: [number, unknown]): SimHandler => (hit, res) => {
    const [status, body] = hit.url.startsWith('/v23.0/1234567890') ? phone : group;
    reply(res, status, body);
  };

  it('número e grupo acessíveis => CONNECTED (com a ressalva de "a validar")', async () => {
    const { pub, sim } = await setup(route([200, { display_phone_number: '+55 11 99999-0000', id: '1' }], [200, { subject: 'Grupo' }]));
    const h = await pub.healthCheck();
    expect(h).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect(h.detail).toContain('+55 11 99999-0000');
    expect(h.detail).toContain('grupo acessível');
    expect(h.detail).toMatch(/a validar com credenciais reais/);
    expect(sim.hits[0]!.headers.authorization).toBe(`Bearer ${WA_TOKEN}`);
    expect(sim.hits[0]!.url).toContain('fields=');
    expect(leaks(h)).toEqual([]);
  });

  it('grupo não consultável não derruba a conexão, mas avisa para conferir o groupId', async () => {
    const { pub } = await setup(route([200, { display_phone_number: '+55 11 99999-0000' }], [404, { error: { message: 'Unsupported get request', code: 100 } }]));
    const h = await pub.healthCheck();
    expect(h.status).toBe('CONNECTED');
    expect(h.detail).toMatch(/groupId/);
  });

  it.each([401, 403])('número HTTP %s => AUTH_REQUIRED', async (status) => {
    const { pub } = await setup(route([status, { error: { message: `token ${WA_TOKEN} recusado`, code: 190 } }], [200, {}]));
    const h = await pub.healthCheck();
    expect(h).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(leaks(h)).toEqual([]);
  });

  it('número HTTP 500 => ERROR; sem conexão => ERROR', async () => {
    const { pub } = await setup(route([500, { error: { message: 'boom', code: 1 } }], [200, {}]));
    expect(await pub.healthCheck()).toMatchObject({ ok: false, status: 'ERROR' });
    await sim?.close();
    const dead = await startSim(ok());
    const url = dead.url;
    await dead.close();
    const offline = new WhatsAppCloudGroupPublisher({ accessToken: WA_TOKEN, phoneNumberId: '1234567890', groupId: 'g', baseUrl: url });
    expect(await offline.healthCheck()).toMatchObject({ ok: false, status: 'ERROR' });
  });
});
