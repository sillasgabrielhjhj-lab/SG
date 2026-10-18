/**
 * Timeout dos adaptadores (sim): o servidor aceita a conexão mas nunca responde. Os prazos reais (15 s/10 s) são
 * encurtados com vi.mock para o teste ser rápido; o comportamento esperado é "falha de rede retentável", nunca
 * sucesso e nunca erro permanente.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/publishers/common.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/adapters/publishers/common.js')>();
  return { ...real, SEND_TIMEOUT_MS: 400, HEALTH_TIMEOUT_MS: 400 };
});

import { TelegramPublisher } from '../../src/adapters/publishers/telegram.js';
import { WebhookPublisher } from '../../src/adapters/publishers/webhook.js';
import { WhatsAppCloudGroupPublisher } from '../../src/adapters/publishers/whatsapp-cloud.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { TG_TOKEN, WA_TOKEN, WH_SECRET, leaks, reply, startSim, type SimServer } from '../helpers/publishing-fixtures.js';

beforeAll(() => setSsrfAllowPrivateForTests(true));
afterAll(() => setSsrfAllowPrivateForTests(false));

let sim: SimServer | null = null;
afterEach(async () => {
  await sim?.close();
  sim = null;
});
const hang = () => startSim(() => undefined); // nunca responde
const KEY = 'offer-1:chan-1';

describe('timeout dos adaptadores (sim)', () => {
  it('Telegram: servidor mudo => falha de rede retentável (FETCH_TIMEOUT) dentro do prazo', async () => {
    sim = await hang();
    const t0 = Date.now();
    const r = await new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: sim.url }).send({ text: 'oferta', idempotencyKey: KEY });
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.authRequired).toBeFalsy();
    expect(r.error).toMatch(/Falha de rede \(FETCH_TIMEOUT\)/);
    expect(leaks(r)).toEqual([]);
    expect(sim.hits).toHaveLength(1); // sem retentativa interna: quem retenta é o serviço
  });

  it('WhatsApp Cloud: servidor mudo => falha de rede retentável', async () => {
    sim = await hang();
    const r = await new WhatsAppCloudGroupPublisher({ accessToken: WA_TOKEN, phoneNumberId: '1234567890', groupId: 'g', baseUrl: sim.url }).send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.error).toMatch(/FETCH_TIMEOUT/);
    expect(leaks(r)).toEqual([]);
  });

  it('Webhook: servidor mudo => falha de rede retentável', async () => {
    sim = await hang();
    const r = await new WebhookPublisher({ url: `${sim.url}/hook`, secret: WH_SECRET }).send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: false, confirmed: false });
    expect(r.permanent).toBeFalsy();
    expect(r.error).toMatch(/FETCH_TIMEOUT/);
  });

  it('resposta que chega a tempo continua funcionando (o prazo não é curto demais para o simulador)', async () => {
    sim = await startSim(async (_h, res) => {
      await new Promise((r) => setTimeout(r, 100));
      reply(res, 200, { ok: true, result: { message_id: 5 } });
    });
    const r = await new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: sim.url }).send({ text: 'oferta', idempotencyKey: KEY });
    expect(r).toMatchObject({ ok: true, confirmed: true, externalMessageId: '5' });
  });

  it('testes de conexão também respeitam o prazo (ERROR, não travam)', async () => {
    sim = await hang();
    const t0 = Date.now();
    const tg = await new TelegramPublisher({ botToken: TG_TOKEN, chatId: '@canal_teste', baseUrl: sim.url }).healthCheck();
    const wa = await new WhatsAppCloudGroupPublisher({ accessToken: WA_TOKEN, phoneNumberId: '1234567890', groupId: 'g', baseUrl: sim.url }).healthCheck();
    const wh = await new WebhookPublisher({ url: `${sim.url}/hook`, secret: WH_SECRET }).healthCheck();
    expect(Date.now() - t0).toBeLessThan(5000);
    for (const h of [tg, wa, wh]) {
      expect(h).toMatchObject({ ok: false, status: 'ERROR' });
      expect(leaks(h)).toEqual([]);
    }
  });
});
