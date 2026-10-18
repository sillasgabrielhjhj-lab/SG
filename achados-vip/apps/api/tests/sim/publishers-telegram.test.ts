/**
 * Telegram Bot API (Modo C) contra um servidor HTTP SIMULADO em localhost (nenhuma rede externa).
 * Cobre: sucesso, legenda <= 1024, 401/403/404 (authRequired), 429 (retry_after / Retry-After), 500, resposta sem
 * message_id (não confirmado), falha de rede e a garantia de que o token nunca aparece nos resultados.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SendResult } from '../../src/domain/types.js';
import { TELEGRAM_CAPTION_MAX, TELEGRAM_TEXT_MAX, TelegramPublisher } from '../../src/adapters/publishers/telegram.js';
import { MAX_RETRY_AFTER_MS } from '../../src/adapters/publishers/common.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { formatMessage } from '../../src/services/message-formatter.js';
import { TG_TOKEN, leaks, reply, startSim, type SimHandler, type SimServer } from '../helpers/publishing-fixtures.js';

beforeAll(() => setSsrfAllowPrivateForTests(true));
afterAll(() => setSsrfAllowPrivateForTests(false));

const IMG = 'https://http2.mlstatic.com/D_NQ_NP_2.jpg';
const KEY = 'offer-1:chan-1';
let sim: SimServer | null = null;
afterEach(async () => {
  await sim?.close();
  sim = null;
});

async function setup(handler: SimHandler): Promise<{ pub: TelegramPublisher; sim: SimServer }> {
  sim = await startSim(handler);
  return { sim, pub: new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: sim.url }) };
}
const ok = (messageId: number | string = 42): SimHandler => (_h, res) => reply(res, 200, { ok: true, result: { message_id: messageId, chat: { id: 1 } } });
const tgError = (status: number, description: string, extra: Record<string, unknown> = {}): SimHandler => (_h, res, ) => reply(res, status, { ok: false, error_code: status, description, ...extra });
/** Nenhum resultado pode conter o token do bot. */
const clean = (r: SendResult) => expect(leaks(r)).toEqual([]);

describe('Telegram (sim): envio e confirmação', () => {
  it('texto sem imagem => sendMessage em HTML, com preview do link; confirmado pelo message_id', async () => {
    const { pub, sim } = await setup(ok(42));
    const r = await pub.send({ text: '<b>Oferta</b> https://meli.la/2aBcDeF', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: '42', httpStatus: 200 });
    expect(sim.hits).toHaveLength(1);
    const hit = sim.hits[0]!;
    expect(hit.method).toBe('POST');
    expect(hit.url).toBe(`/bot${TG_TOKEN}/sendMessage`);
    expect(hit.headers['content-type']).toMatch(/application\/json/);
    expect(hit.json()).toEqual({
      chat_id: '@canal_teste',
      text: '<b>Oferta</b> https://meli.la/2aBcDeF',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false, url: 'https://meli.la/2aBcDeF', prefer_large_media: true },
    });
    clean(r);
  });

  it('imagem https + texto <= 1024 => sendPhoto com a legenda; message_id string também confirma', async () => {
    const { pub, sim } = await setup(ok('777'));
    const text = 'Legenda '.repeat(10);
    const r = await pub.send({ text, imageUrl: IMG, idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: '777' });
    expect(sim.hits[0]!.url).toBe(`/bot${TG_TOKEN}/sendPhoto`);
    expect(sim.hits[0]!.json()).toMatchObject({ chat_id: '@canal_teste', photo: IMG, caption: text, parse_mode: 'HTML' });
  });

  it('legenda: 1024 caracteres vai como foto; 1025 cai para sendMessage (nunca legenda > 1024)', async () => {
    const { pub, sim } = await setup(ok());
    expect(TELEGRAM_CAPTION_MAX).toBe(1024);
    await pub.send({ text: 'a'.repeat(1024), imageUrl: IMG, idempotencyKey: KEY });
    await pub.send({ text: 'a'.repeat(1025), imageUrl: IMG, idempotencyKey: KEY });
    expect(sim.hits.map((h) => h.url.split('/').pop())).toEqual(['sendPhoto', 'sendMessage']);
    for (const h of sim.hits.filter((x) => x.url.endsWith('/sendPhoto'))) expect((h.json().caption as string).length).toBeLessThanOrEqual(1024);
    expect(sim.hits[1]!.json().text).toHaveLength(1025); // o texto não é truncado
  });

  it('mensagens reais do formatador (HTML) nunca geram sendPhoto com legenda > 1024, nem perdem o link', async () => {
    const { pub, sim } = await setup(ok());
    const longUrl = `https://www.mercadolivre.com.br/social/achados?matt_tool=1&ref=${'x'.repeat(1400)}`;
    const base = { priceCents: 129990, originalPriceCents: 199990, discountPct: 35, kind: 'COUPON' as const, couponCode: 'VIP10', couponDiscountCents: 1000, installments: { quantity: 10, amountCents: 12999, interestFree: true }, disclosure: 'Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado. '.repeat(3) };
    const variants = [
      { title: 'Fone Bluetooth JBL Tune 520BT Preto', affiliateUrl: 'https://meli.la/2aBcDeF' },
      { title: 'T'.repeat(300) + ' & <Especial> "Edição"', affiliateUrl: 'https://meli.la/2aBcDeF' },
      { title: 'Cafeteira Italiana 6 Xícaras', affiliateUrl: longUrl },
    ];
    for (const v of variants) {
      const text = formatMessage({ ...base, ...v }, 'telegram_html');
      const r = await pub.send({ text, imageUrl: IMG, idempotencyKey: KEY });
      expect(r.confirmed).toBe(true);
      const hit = sim.hits.at(-1)!;
      if (hit.url.endsWith('/sendPhoto')) expect((hit.json().caption as string).length).toBeLessThanOrEqual(1024);
      else expect(hit.json().text).toBe(text);
      expect(JSON.stringify(hit.json())).toContain(v.affiliateUrl.slice(0, 40));
    }
    // a URL longa estoura a legenda: tem que ter ido como mensagem de texto com o link inteiro (& escapado no HTML)...
    const last = sim.hits.at(-1)!;
    expect(last.url.endsWith('/sendMessage')).toBe(true);
    expect(last.json().text).toContain(longUrl.replace(/&/g, '&amp;'));
    // ...e a URL da pré-visualização é a ORIGINAL (com "&", nunca "&amp;")
    expect(last.json().link_preview_options.url).toBe(longUrl);
  });

  it('imagem http (não https) ou ausente => sendMessage', async () => {
    const { pub, sim } = await setup(ok());
    await pub.send({ text: 'oi https://meli.la/a', imageUrl: 'http://exemplo.com/a.jpg', idempotencyKey: KEY });
    await pub.send({ text: 'oi https://meli.la/a', imageUrl: null, idempotencyKey: KEY });
    expect(sim.hits.map((h) => h.url.split('/').pop())).toEqual(['sendMessage', 'sendMessage']);
  });

  it('texto vazio ou maior que 4096 => erro permanente SEM chamar a API', async () => {
    const { pub, sim } = await setup(ok());
    expect(TELEGRAM_TEXT_MAX).toBe(4096);
    const empty = await pub.send({ text: '   ', idempotencyKey: KEY });
    const big = await pub.send({ text: 'a'.repeat(4097), idempotencyKey: KEY });
    for (const r of [empty, big]) expect(r).toMatchObject({ ok: false, confirmed: false, permanent: true });
    expect(sim.hits).toHaveLength(0);
  });

  it('foto recusada pelo Telegram (400 ao baixar a imagem) => reenvia só o texto e confirma', async () => {
    const { pub, sim } = await setup((hit, res) =>
      hit.url.endsWith('/sendPhoto') ? reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: failed to get HTTP URL content' }) : reply(res, 200, { ok: true, result: { message_id: 9 } }),
    );
    const r = await pub.send({ text: 'oferta https://meli.la/a', imageUrl: IMG, idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: '9' });
    expect(sim.hits.map((h) => h.url.split('/').pop())).toEqual(['sendPhoto', 'sendMessage']);
  });
});

describe('Telegram (sim): resposta sem confirmação NUNCA é sucesso', () => {
  const bodies: [string, string | object, number][] = [
    ['ok:true sem result', { ok: true }, 200],
    ['result sem message_id', { ok: true, result: {} }, 200],
    ['message_id vazio', { ok: true, result: { message_id: '' } }, 200],
    ['ok:false com HTTP 200', { ok: false, description: 'algo' }, 200],
    ['corpo não-JSON', 'OK', 200],
    ['corpo vazio', '', 200],
    ['array', '[]', 200],
  ];
  it.each(bodies)('%s => ok=false, confirmed=false, httpStatus=200 (retentável)', async (_label, body, status) => {
    const { pub } = await setup((_h, res) => reply(res, status, body));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 200 });
    expect(r.externalMessageId).toBeUndefined();
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/NÃO confirmado/);
  });
});

describe('Telegram (sim): erros HTTP', () => {
  it.each([401, 403, 404])('HTTP %s => authRequired + permanent (o serviço pausa o canal)', async (status) => {
    const { pub, sim } = await setup(tgError(status, status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden: bot was kicked from the channel chat' : 'Not Found'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status, authRequired: true, permanent: true });
    expect(r.error).toContain(`Telegram ${status}`);
    expect(sim.hits).toHaveLength(1); // sem retentativa interna
    clean(r);
  });

  it('429 com parameters.retry_after => retryAfterMs em ms, retentável (não permanente, não auth)', async () => {
    const { pub, sim } = await setup(tgError(429, 'Too Many Requests: retry after 7', { parameters: { retry_after: 7 } }));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 429, retryAfterMs: 7000 });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(sim.hits).toHaveLength(1);
  });

  it('429 só com o cabeçalho Retry-After => usa o cabeçalho; sem nenhum dos dois => sem retryAfterMs', async () => {
    const a = await setup((_h, res) => reply(res, 429, { ok: false, description: 'Too Many Requests' }, { 'retry-after': '3' }));
    expect(await a.pub.send({ text: 'x', idempotencyKey: KEY })).toMatchObject({ httpStatus: 429, retryAfterMs: 3000 });
    await sim?.close();
    const b = await setup((_h, res) => reply(res, 429, { ok: false, description: 'Too Many Requests' }));
    const r = await b.pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r.httpStatus).toBe(429);
    expect(r.retryAfterMs).toBeUndefined();
  });

  it('retry_after absurdo é limitado a 6h', async () => {
    const { pub } = await setup(tgError(429, 'Too Many Requests', { parameters: { retry_after: 999_999 } }));
    expect((await pub.send({ text: 'x', idempotencyKey: KEY })).retryAfterMs).toBe(MAX_RETRY_AFTER_MS);
  });

  it.each([500, 502, 503, 504])('HTTP %s => retentável (sem permanent/authRequired) e sem retentativa interna', async (status) => {
    const { pub, sim } = await setup(tgError(status, 'Internal Server Error'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: status });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(sim.hits).toHaveLength(1);
  });

  it('400 (chat inexistente, mensagem inválida) => permanente, sem authRequired', async () => {
    const { pub } = await setup(tgError(400, 'Bad Request: chat not found'));
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, httpStatus: 400, permanent: true });
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/chat not found/);
  });

  it('falha de rede (conexão recusada) => retentável, sem vazar o token', async () => {
    const dead = await startSim(ok());
    const url = dead.url;
    await dead.close();
    const pub = new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: url });
    const r = await pub.send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/Falha de rede/);
    clean(r);
  });
});

describe('Telegram (sim): o token nunca aparece em erros/respostas', () => {
  it('descrição que ecoa a URL com o token (bot<token>) é sanitizada em error e response', async () => {
    const { pub } = await setup(tgError(400, `Bad Request: can't parse https://api.telegram.org/bot${TG_TOKEN}/sendMessage`));
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r.error).toContain('bot[REDACTED]');
    clean(r);
  });

  it('em todos os cenários de erro nenhum SendResult contém o token', async () => {
    const scenarios: SimHandler[] = [
      tgError(401, `Unauthorized bot${TG_TOKEN}`),
      tgError(429, 'Too Many Requests', { parameters: { retry_after: 1 } }),
      tgError(500, `boom ${'bot' + TG_TOKEN}`),
      (_h, res) => reply(res, 200, { ok: true, result: {}, echo: `/bot${TG_TOKEN}/sendMessage` }),
    ];
    for (const handler of scenarios) {
      const { pub } = await setup(handler);
      clean(await pub.send({ text: 'x', idempotencyKey: KEY }));
      await sim?.close();
    }
  });
});

describe('Telegram (sim): teste de conexão', () => {
  const route = (map: Record<string, [number, unknown]>): SimHandler => (hit, res) => {
    const method = hit.url.split('/').pop() ?? '';
    const [status, body] = map[method] ?? [404, { ok: false, description: 'Not Found' }];
    reply(res, status, body);
  };

  it('getMe + getChat OK => CONNECTED (menciona @bot e o chat, sem o token)', async () => {
    const { pub, sim } = await setup(route({ getMe: [200, { ok: true, result: { username: 'achados_bot' } }], getChat: [200, { ok: true, result: { title: 'Achados VIP' } }] }));
    const h = await pub.healthCheck();
    expect(h).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect(h.detail).toContain('@achados_bot');
    expect(h.detail).toContain('Achados VIP');
    expect(sim.hits.map((x) => x.url.split('/').pop())).toEqual(['getMe', 'getChat']);
    expect(leaks(h)).toEqual([]);
  });

  it.each([401, 404])('getMe %s => AUTH_REQUIRED', async (status) => {
    const { pub } = await setup(route({ getMe: [status, { ok: false, description: 'Unauthorized' }] }));
    expect(await pub.healthCheck()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
  });

  it('getMe 500 => ERROR; getChat 403 => AUTH_REQUIRED; getChat 400 => ERROR', async () => {
    const me = [200, { ok: true, result: { username: 'bot' } }] as [number, unknown];
    expect((await (await setup(route({ getMe: [500, { ok: false }] }))).pub.healthCheck()).status).toBe('ERROR');
    await sim?.close();
    expect((await (await setup(route({ getMe: me, getChat: [403, { ok: false, description: 'Forbidden' }] }))).pub.healthCheck()).status).toBe('AUTH_REQUIRED');
    await sim?.close();
    const last = await (await setup(route({ getMe: me, getChat: [400, { ok: false, description: 'Bad Request: chat not found' }] }))).pub.healthCheck();
    expect(last).toMatchObject({ ok: false, status: 'ERROR' });
    expect(last.detail).toMatch(/chat not found/);
  });

  it('sem conexão => ERROR', async () => {
    const dead = await startSim(ok());
    const url = dead.url;
    await dead.close();
    const pub = new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: url });
    const h = await pub.healthCheck();
    expect(h).toMatchObject({ ok: false, status: 'ERROR' });
    expect(leaks(h)).toEqual([]);
  });
});
