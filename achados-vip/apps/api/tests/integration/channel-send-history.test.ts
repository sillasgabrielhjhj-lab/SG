/**
 * O teste de conexão não pode mascarar um canal cujo ÚLTIMO envio foi recusado (401/403):
 * getMe pode responder OK mesmo com o bot sem permissão de postar.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { applySendHistory } from '../../src/services/channels.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { HOUR, ago, seedChannel, seedOffer, seedPublication } from '../helpers/publishing-fixtures.js';

const OK = { ok: true, status: 'CONNECTED' as const, detail: 'getMe ok' };

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});

async function attempt(channelId: string, data: { success: boolean; httpStatus: number; startedAt: Date }) {
  const { offer, link } = await seedOffer();
  const ch = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: channelId } });
  const pub = await seedPublication(offer, ch, link, { status: 'FAILED' });
  await prisma.publicationAttempt.create({ data: { publicationId: pub.id, ...data } });
}

describe('applySendHistory', () => {
  it('sem histórico de envio mantém CONNECTED', async () => {
    const ch = await seedChannel('TELEGRAM');
    expect(await applySendHistory(ch.id, OK)).toEqual(OK);
  });

  it('último envio recusado com 403 => AUTH_REQUIRED, mesmo com a conexão respondendo', async () => {
    const ch = await seedChannel('TELEGRAM');
    await attempt(ch.id, { success: false, httpStatus: 403, startedAt: ago(HOUR) });
    const r = await applySendHistory(ch.id, OK);
    expect(r.ok).toBe(false);
    expect(r.status).toBe('AUTH_REQUIRED');
    expect(r.detail).toContain('HTTP 403');
  });

  it('um envio bem-sucedido DEPOIS da recusa libera o canal', async () => {
    const ch = await seedChannel('TELEGRAM');
    await attempt(ch.id, { success: false, httpStatus: 403, startedAt: ago(2 * HOUR) });
    await attempt(ch.id, { success: true, httpStatus: 200, startedAt: ago(HOUR) });
    expect((await applySendHistory(ch.id, OK)).status).toBe('CONNECTED');
  });

  it('falha 500 (não é recusa de autorização) não derruba o status', async () => {
    const ch = await seedChannel('TELEGRAM');
    await attempt(ch.id, { success: false, httpStatus: 500, startedAt: ago(HOUR) });
    expect((await applySendHistory(ch.id, OK)).status).toBe('CONNECTED');
  });

  it('não altera resultado que já é problema e ignora tentativas de outro canal', async () => {
    const a = await seedChannel('TELEGRAM');
    const b = await seedChannel('TELEGRAM');
    await attempt(b.id, { success: false, httpStatus: 403, startedAt: ago(HOUR) });
    const bad = { ok: false, status: 'ERROR' as const, detail: 'timeout' };
    expect(await applySendHistory(a.id, bad)).toEqual(bad);
    expect((await applySendHistory(a.id, OK)).status).toBe('CONNECTED');
  });
});
