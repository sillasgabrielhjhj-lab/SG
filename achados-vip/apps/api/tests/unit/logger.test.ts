import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, isSensitiveKey, REDACTED, sanitizeForLog, scrubString } from '../../src/lib/logger.js';

const TG_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
const ML_TOKEN = 'APP_USR-1234567890123456-101720-abcdef0123456789abcdef0123456789-98765432';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { logger: createLogger(stream, 'debug'), output: () => lines.join('') };
}

describe('sanitizeForLog / scrubString', () => {
  it('redige valores de chaves sensíveis em qualquer profundidade', () => {
    const out = sanitizeForLog({
      ok: 'visível',
      access_token: 'AAA',
      Authorization: 'Bearer BBB',
      nested: { password: 'p', list: [{ client_secret: 'c', n: 1 }], cookie: 'achados_sid=zzz' },
      botToken: 'dddd',
      encrypted: 'blob',
    }) as Record<string, any>;
    expect(out.ok).toBe('visível');
    expect(out.access_token).toBe(REDACTED);
    expect(out.Authorization).toBe(REDACTED);
    expect(out.nested.password).toBe(REDACTED);
    expect(out.nested.list[0].client_secret).toBe(REDACTED);
    expect(out.nested.list[0].n).toBe(1);
    expect(out.nested.cookie).toBe(REDACTED);
    expect(out.botToken).toBe(REDACTED);
    expect(out.encrypted).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toMatch(/AAA|BBB|zzz|dddd|blob/);
  });

  it('remove segredos embutidos em texto (URLs, headers, JSON, tokens conhecidos)', () => {
    const text = [
      `GET https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      'https://api.mercadolibre.com/items?access_token=SEGREDO1&limit=5',
      'Authorization: Bearer abcdefghijklmnop123456',
      '{"refresh_token":"SEGREDO2","ok":true}',
      `token ml ${ML_TOKEN}`,
      'https://usuario:senha123@host.exemplo.com/x',
      'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
    ].join(' | ');
    const clean = scrubString(text);
    for (const leaked of [TG_TOKEN, 'SEGREDO1', 'abcdefghijklmnop123456', 'SEGREDO2', 'abcdef0123456789abcdef0123456789', 'senha123', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0']) {
      expect(clean).not.toContain(leaked);
    }
    expect(clean).toContain('limit=5'); // o resto permanece útil
  });

  it('serializa Error sem vazar token na mensagem e trata ciclos/BigInt/Date', () => {
    const circular: any = { a: 1 };
    circular.self = circular;
    const out = sanitizeForLog({ err: new Error(`falhou com Bearer ${'x'.repeat(20)}`), circular, big: 10n, when: new Date('2026-01-02T03:04:05Z') }) as any;
    expect(out.err.message).not.toContain('xxxxxxxxxx');
    expect(out.circular.self).toBe('[Circular]');
    expect(out.big).toBe('10');
    expect(out.when).toBe('2026-01-02T03:04:05.000Z');
  });

  it('isSensitiveKey', () => {
    for (const k of ['token', 'accessToken', 'client_secret', 'password', 'Authorization', 'set-cookie', 'apiKey', 'x-signature']) expect(isSensitiveKey(k)).toBe(true);
    for (const k of ['title', 'priceCents', 'dedupeKey', 'scope']) expect(isSensitiveKey(k)).toBe(false);
  });
});

describe('logger (pino)', () => {
  it('o token NÃO aparece na saída, seja em objeto, mensagem, erro ou headers', () => {
    const { logger, output } = capture();
    logger.info({ token: 'TOKEN-OBJ', user: { password: 'SENHA-OBJ' }, headers: { authorization: 'Bearer HDR-TOKEN-123456' } }, 'objeto');
    logger.warn(`chamada https://x.com/api?access_token=TOKEN-URL&a=1`);
    logger.error({ err: new Error(`Telegram falhou: bot${TG_TOKEN}`) }, 'erro');
    logger.info({ req: { method: 'POST', url: '/cb?code=CODIGO-OAUTH&state=1', ip: '1.2.3.4', headers: { cookie: 'achados_sid=COOKIE-SECRETO' } } }, 'req');
    const out = output();
    for (const leaked of ['TOKEN-OBJ', 'SENHA-OBJ', 'HDR-TOKEN-123456', 'TOKEN-URL', TG_TOKEN, 'CODIGO-OAUTH', 'COOKIE-SECRETO']) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain('objeto');
    expect(out).toContain('state=1');
  });
});
