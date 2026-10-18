import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, hmacSign, hmacVerify, randomToken, secretHint, sha256, timingSafeEqual } from '../../src/lib/crypto.js';

const key = randomBytes(32);

describe('criptografia AES-256-GCM', () => {
  it('round-trip de objetos JSON', () => {
    const value = { botToken: '123456:ABC-segredo', nested: { n: 1, arr: ['á', 'ç'] }, nulo: null };
    const enc = encryptJson(value, key);
    expect(decryptJson(enc, key)).toEqual(value);
  });

  it('formato base64(iv|tag|ct) e o texto puro não aparece no resultado', () => {
    const enc = encryptJson({ token: 'SEGREDO-VISIVEL' }, key);
    const raw = Buffer.from(enc, 'base64');
    expect(raw.length).toBeGreaterThan(12 + 16);
    expect(enc).not.toContain('SEGREDO-VISIVEL');
    expect(raw.toString('utf8')).not.toContain('SEGREDO-VISIVEL');
  });

  it('IV aleatório: o mesmo valor gera cifras diferentes', () => {
    expect(encryptJson('x', key)).not.toBe(encryptJson('x', key));
  });

  it.each([
    ['iv', 0],
    ['tag', 12],
    ['ciphertext', 28],
  ])('adulteração do %s faz a decifragem falhar', (_name, offset) => {
    const raw = Buffer.from(encryptJson({ a: 1 }, key), 'base64');
    raw[offset] = (raw[offset] ?? 0) ^ 0x01;
    expect(() => decryptJson(raw.toString('base64'), key)).toThrow();
  });

  it('chave errada, dado truncado e lixo falham', () => {
    const enc = encryptJson({ a: 1 }, key);
    expect(() => decryptJson(enc, randomBytes(32))).toThrow();
    expect(() => decryptJson(enc.slice(0, 20), key)).toThrow();
    expect(() => decryptJson('nao-e-base64-valido!!', key)).toThrow();
  });

  it('exige chave de 32 bytes', () => {
    expect(() => encryptJson({}, randomBytes(16))).toThrow();
  });
});

describe('utilitários', () => {
  it('sha256 conhecido', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('randomToken: tamanho e unicidade', () => {
    const a = randomToken(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(a);
  });

  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual(Buffer.from('x'), 'x')).toBe(true);
  });

  it('hmacSign confere com o vetor de teste da RFC 4231 (caso 2)', () => {
    const sig = hmacSign('what do ya want for nothing?', 'Jefe');
    expect(sig).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    expect(hmacVerify('what do ya want for nothing?', 'Jefe', sig)).toBe(true);
    expect(hmacVerify('outra coisa', 'Jefe', sig)).toBe(false);
  });

  it('secretHint mostra só os 4 últimos caracteres', () => {
    expect(secretHint('123456789:ABCDEFGHIJ')).toBe('••••GHIJ');
    expect(secretHint('curto')).toBe('••••');
  });
});
