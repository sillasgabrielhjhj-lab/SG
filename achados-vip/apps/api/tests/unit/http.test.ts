import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpError, httpJson, httpRequest, parseRetryAfter, redactUrl } from '../../src/lib/http.js';
import { SsrfBlockedError, type Resolver } from '../../src/lib/ssrf.js';

// Servidor LOCAL SIMULADO (nenhuma rede externa). O host fictício aponta para ele via resolver injetado.
const HOST = 'api-simulada.test';
const resolver: Resolver = async () => [{ address: '127.0.0.1', family: 4 }];
const net = { allowPrivate: (h: string) => h === HOST, resolver };

let server: http.Server;
let port: number;
const calls: Record<string, number> = {};
let lastRequest: { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string } | null = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const url = req.url ?? '';
      lastRequest = { method: req.method, url, headers: req.headers, body: Buffer.concat(chunks).toString() };
      calls[url] = (calls[url] ?? 0) + 1;
      const n = calls[url] as number;
      if (url.startsWith('/flaky')) {
        if (n < 3) {
          res.statusCode = 503;
          res.setHeader('retry-after', '0');
          return void res.end('indisponível');
        }
        return void res.end(JSON.stringify({ ok: true, tentativa: n }));
      }
      if (url.startsWith('/limit')) {
        res.statusCode = 429;
        return void res.end('devagar');
      }
      if (url.startsWith('/erro-com-token')) {
        res.statusCode = 400;
        return void res.end('{"message":"token inválido","access_token":"SEGREDO-NO-CORPO"}');
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ eco: true }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
});

const url = (p: string) => `http://${HOST}:${port}${p}`;

describe('httpRequest', () => {
  it('monta a query, envia JSON com content-type e devolve resultado sem lançar em não-2xx', async () => {
    const res = await httpRequest(url('/eco'), { ...net, method: 'POST', query: { a: 1, b: 'x y', omitido: undefined }, json: { n: 1 } });
    expect(res.ok).toBe(true);
    expect(res.json()).toEqual({ eco: true });
    expect(lastRequest?.url).toBe('/eco?a=1&b=x+y');
    expect(lastRequest?.headers['content-type']).toBe('application/json');
    expect(lastRequest?.body).toBe('{"n":1}');
    expect(res.url).toBe(url('/eco')); // sem query na URL devolvida (segura para logs)
  });

  it('GET repete em 503 respeitando Retry-After e acaba com sucesso', async () => {
    const res = await httpRequest(url('/flaky-get'), { ...net, retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(res.attempts).toBe(3);
    expect(calls['/flaky-get']).toBe(3);
  });

  it('POST NÃO repete por padrão (evita envio duplicado), mas aceita retries explícitos', async () => {
    const res = await httpRequest(url('/flaky-post'), { ...net, method: 'POST', json: {} });
    expect(res.status).toBe(503);
    expect(calls['/flaky-post']).toBe(1);
    const retried = await httpRequest(url('/flaky-post2'), { ...net, method: 'POST', json: {}, retries: 3, retryDelayMs: 1 });
    expect(retried.status).toBe(200);
  });

  it('esgotadas as tentativas devolve o último 429 (sem lançar)', async () => {
    const res = await httpRequest(url('/limit'), { ...net, retries: 1, retryDelayMs: 1 });
    expect(res.status).toBe(429);
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(2);
  });

  it('bloqueio SSRF não é repetido e propaga o erro', async () => {
    await expect(httpRequest('http://169.254.169.254/latest/meta-data/', { retries: 3, retryDelayMs: 1 })).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(httpRequest(`http://127.0.0.1:${port}/eco`)).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

describe('httpJson / utilitários', () => {
  it('lança HttpError com corpo sanitizado em não-2xx', async () => {
    const err = await httpJson(url('/erro-com-token?access_token=SEGREDO-NA-URL'), net).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    const e = err as HttpError;
    expect(e.status).toBe(400);
    expect(e.url).toBe(url('/erro-com-token'));
    expect(e.bodySnippet).not.toContain('SEGREDO-NO-CORPO');
    expect(e.message).not.toContain('SEGREDO');
    expect(await httpJson(url('/eco'), net)).toEqual({ eco: true });
  });

  it('redactUrl remove query, fragmento, credenciais e token de bot', () => {
    expect(redactUrl('https://user:pw@api.exemplo.com/x?token=abc#frag')).toBe('https://api.exemplo.com/x');
    expect(redactUrl('https://api.telegram.org/bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/sendMessage')).toBe('https://api.telegram.org/bot[REDACTED]/sendMessage');
  });

  it('parseRetryAfter: segundos, data HTTP e inválido', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(['2'])).toBe(2000);
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:10 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(10_000);
    expect(parseRetryAfter('lixo')).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });
});
