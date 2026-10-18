/**
 * Modo PRODUÇÃO (sim): o módulo `env` é recarregado com NODE_ENV=production para provar que, em produção,
 * (1) destinos internos/privados são recusados pela proteção SSRF, (2) o relaxamento de testes (allowPrivate) é
 * proibido e (3) a configuração dos canais só aceita hosts oficiais/https. Nenhuma conexão de rede é aberta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WH_SECRET } from '../helpers/publishing-fixtures.js';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6');
  vi.stubEnv('APP_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
  vi.stubEnv('DATABASE_URL', 'postgresql://achados:achados@localhost:5432/achados_test');
  vi.stubEnv('REDIS_URL', 'redis://localhost:6379/15');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const KEY = 'offer-1:chan-1';

describe('produção (sim): SSRF e configuração dos canais', () => {
  it('o ambiente carregado é mesmo de produção e o relaxamento de testes é proibido', async () => {
    const { env } = await import('../../src/lib/env.js');
    expect(env.isProduction).toBe(true);
    const ssrf = await import('../../src/lib/ssrf.js');
    expect(() => ssrf.setSsrfAllowPrivateForTests(true)).toThrow(/proibido em produção/);
    await expect(ssrf.assertSafeUrl('http://127.0.0.1/', { allowPrivate: true })).rejects.toThrow(/proibido em produção/);
  });

  it.each([
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://127.0.0.1:8443/hook',
    'https://[::1]/hook',
    'https://10.1.2.3/hook',
    'https://172.20.0.5/hook',
    'https://192.168.0.10/hook',
    'https://100.64.1.1/hook',
    'https://169.254.169.254/latest/meta-data/iam',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://servico.local/hook',
    'https://0.0.0.0/hook',
  ])('webhook para %s => SSRF recusa, erro permanente e sem conexão', async (url) => {
    const { WebhookPublisher } = await import('../../src/adapters/publishers/webhook.js');
    const pub = new WebhookPublisher({ url, secret: WH_SECRET });
    const r = await pub.send({ text: 'x', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false, permanent: true });
    expect(r.error).toMatch(/proteção SSRF/);
    expect(r.error).not.toMatch(/Falha de rede/);
    const h = await pub.healthCheck();
    expect(h).toMatchObject({ ok: false, status: 'ERROR' });
    expect(h.detail).toMatch(/SSRF/);
  });

  it('configuração do webhook em produção: só https e sem credenciais na URL', async () => {
    const { WebhookConfigSchema } = await import('../../src/adapters/publishers/config.js');
    expect(WebhookConfigSchema.safeParse({ url: 'https://hooks.exemplo.com/x' }).success).toBe(true);
    for (const url of ['http://hooks.exemplo.com/x', 'https://u:p@hooks.exemplo.com/x', 'ftp://hooks.exemplo.com/x', 'não é url']) {
      expect(WebhookConfigSchema.safeParse({ url }).success, url).toBe(false);
    }
    expect(WebhookConfigSchema.safeParse({ url: 'https://hooks.exemplo.com/x', token: 'x' }).success).toBe(false); // strict: sem segredos na config
  });

  it('baseUrl do Telegram/WhatsApp em produção só vale para o host oficial (impede capturar o token em servidor próprio)', async () => {
    const { TelegramConfigSchema, WhatsAppCloudConfigSchema } = await import('../../src/adapters/publishers/config.js');
    const tg = (baseUrl?: string) => TelegramConfigSchema.safeParse({ chatId: '@canal_teste', ...(baseUrl ? { baseUrl } : {}) }).success;
    expect(tg()).toBe(true);
    expect(tg('https://api.telegram.org')).toBe(true);
    for (const bad of ['http://api.telegram.org', 'https://evil.example.com', 'https://api.telegram.org.evil.com', 'http://127.0.0.1:9999', 'https://user:pw@api.telegram.org']) {
      expect(tg(bad), bad).toBe(false);
    }
    const wa = (baseUrl?: string) => WhatsAppCloudConfigSchema.safeParse({ phoneNumberId: '1234567890', groupId: 'g-1', ...(baseUrl ? { baseUrl } : {}) }).success;
    expect(wa()).toBe(true);
    expect(wa('https://graph.facebook.com')).toBe(true);
    for (const bad of ['http://graph.facebook.com', 'https://graph.facebook.com.evil.com', 'https://evil.example.com', 'http://localhost:4000']) {
      expect(wa(bad), bad).toBe(false);
    }
  });

  it('createPublisher recusa canal com baseUrl fora do host oficial (AdapterConfigError "config", sem vazar credenciais)', async () => {
    const { createPublisher, AdapterConfigError } = await import('../../src/adapters/publishers/index.js');
    const creds = { botToken: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0' };
    const err = (() => {
      try {
        createPublisher({ type: 'TELEGRAM', config: { chatId: '@canal_teste', baseUrl: 'https://evil.example.com' } }, creds);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AdapterConfigError);
    expect((err as InstanceType<typeof AdapterConfigError>).kind).toBe('config');
    expect((err as Error).message).not.toContain(creds.botToken);
    // e o caminho feliz continua funcionando
    expect(createPublisher({ type: 'TELEGRAM', config: { chatId: '@canal_teste' } }, creds).type).toBe('TELEGRAM');
  });
});
