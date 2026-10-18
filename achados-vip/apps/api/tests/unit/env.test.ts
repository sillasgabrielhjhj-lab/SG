import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/lib/env.js';

const goodKey = randomBytes(32).toString('base64');
const prod = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/achados',
  REDIS_URL: 'redis://redis:6379',
  APP_ENCRYPTION_KEY: goodKey,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
};

describe('loadEnv', () => {
  it('em desenvolvimento/teste gera defaults de dev e avisa', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    expect(env.encryptionKey).toHaveLength(32);
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.warnings.length).toBeGreaterThan(0);
    expect(env.PORT).toBe(3001);
    expect(loadEnv({ NODE_ENV: 'test' }).LOG_LEVEL).toBe('silent');
  });

  it('em produção exige todos os segredos (lista só os nomes)', () => {
    let error: unknown;
    try {
      loadEnv({ NODE_ENV: 'production' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EnvError);
    const msg = (error as EnvError).message;
    for (const name of ['DATABASE_URL', 'REDIS_URL', 'APP_ENCRYPTION_KEY', 'SESSION_SECRET']) expect(msg).toContain(name);
  });

  it('em produção aceita configuração completa e liga COOKIE_SECURE por padrão', () => {
    const env = loadEnv(prod);
    expect(env.isProduction).toBe(true);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.warnings).toEqual([]);
    expect(env.APP_ENCRYPTION_KEY).toBe(goodKey);
  });

  it.each([
    ['chave de 16 bytes', { APP_ENCRYPTION_KEY: randomBytes(16).toString('base64') }],
    ['chave não-base64', { APP_ENCRYPTION_KEY: 'isto não é base64 de 32 bytes!!!!!!!!!!!!!!' }],
    ['SESSION_SECRET curto', { SESSION_SECRET: 'curto' }],
    ['SESSION_SECRET de exemplo', { SESSION_SECRET: 'change-me-change-me-change-me-change-me' }],
  ])('produção rejeita %s', (_n, override) => {
    expect(() => loadEnv({ ...prod, ...override })).toThrow(EnvError);
  });

  it('valida a chave também fora de produção quando informada', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', APP_ENCRYPTION_KEY: 'abc' })).toThrow(EnvError);
  });

  it('interpreta booleanos, porta e opcionais vazios', () => {
    const env = loadEnv({ ...prod, COOKIE_SECURE: 'false', TRUST_PROXY: '1', PORT: '8080', ML_CLIENT_ID: '', ML_CLIENT_SECRET: 'x', WEB_ORIGIN: 'https://painel.exemplo.com/' });
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.warnings.some((w) => w.includes('COOKIE_SECURE'))).toBe(true);
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.PORT).toBe(8080);
    expect(env.ML_CLIENT_ID).toBeUndefined();
    expect(env.ML_CLIENT_SECRET).toBe('x');
    expect(env.WEB_ORIGIN).toBe('https://painel.exemplo.com');
  });

  it('NODE_ENV inválido não cai silenciosamente em desenvolvimento', () => {
    expect(() => loadEnv({ NODE_ENV: 'prod' })).toThrow(EnvError);
  });
});
