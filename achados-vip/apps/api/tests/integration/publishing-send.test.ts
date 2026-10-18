/**
 * Publicação: envio (sendPublication/processDue) — idempotência, SENT só com confirmação, tentativas, backoff,
 * DEAD + dead-letter + notificação, authRequired, erro permanente, travas no envio e fila manual.
 * Banco e Redis reais de teste; o provedor é um adaptador roteirizado ou um servidor HTTP simulado (localhost).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PublishingChannel } from '@prisma/client';
import { hmacVerify } from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/db.js';
import { ConflictError, NotFoundError, PublishBlockedError } from '../../src/lib/errors.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { addToDeadLetter, closeQueues, getQueue } from '../../src/queues/queues.js';
import { BACKOFF_MS, backoffMs, cancelPublication, enqueueOffer, expireStaleManualQueue, failPublication, markManualSent, processDue, retryPublication, sendPublication, type SendDeps } from '../../src/services/publishing.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb, resetRedis } from '../helpers/db.js';
import {
  DAY,
  HOUR,
  MIN,
  NOW,
  PriceSource,
  TG_TOKEN,
  WH_SECRET,
  WA_TOKEN,
  ago,
  confirmed,
  failure,
  leaks,
  notConfirmed,
  reply,
  scriptedAdapter,
  seedChannel,
  seedCredential,
  seedManualChannel,
  seedOffer,
  seedPublication,
  seedTelegramChannel,
  seedWebhookChannel,
  seedWhatsAppChannel,
  startSim,
  type ScriptedAdapter,
  type SeedOfferOptions,
  type SimServer,
} from '../helpers/publishing-fixtures.js';

beforeAll(() => setSsrfAllowPrivateForTests(true)); // simuladores em 127.0.0.1
afterAll(async () => {
  setSsrfAllowPrivateForTests(false);
  await closeQueues();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  // ritmo frouxo e sem silêncio: estes testes miram o ENVIO (o ritmo tem testes próprios)
  await updateSettings({ publishing: { minIntervalMinutes: 0, maxPerHour: 100, maxPerDay: 100, maxPerCategoryPerDay: 100, quietHours: { enabled: false }, autoPublish: false } });
});

const enqueueDeps = { now: NOW, source: null } as const;
const sendDeps = (adapter: ScriptedAdapter, extra: Partial<SendDeps> = {}): SendDeps => ({ now: NOW, source: null, createAdapter: () => adapter, ...extra });
const webhookCh = () => seedChannel('WEBHOOK', { name: 'Webhook', config: { url: 'https://hooks.exemplo.test/x' } });
const reload = (id: string) => prisma.publication.findUniqueOrThrow({ where: { id } });
const attemptsOf = (id: string) => prisma.publicationAttempt.findMany({ where: { publicationId: id }, orderBy: { startedAt: 'asc' } });
/** |data - (agora + ms)| <= tol: failPublication usa o relógio real para o backoff. */
let userSeq = 0;
const adminUser = () => prisma.user.create({ data: { email: `adm${++userSeq}@teste.local`, passwordHash: 'x' } });
const near = (d: Date | null, ms: number, tol = 15_000): boolean => d !== null && Math.abs(d.getTime() - (Date.now() + ms)) <= tol;

async function queued(channel: PublishingChannel, o: SeedOfferOptions = {}) {
  const s = await seedOffer(o);
  const [pub] = await enqueueOffer(s.offer.id, { channelId: channel.id }, enqueueDeps);
  return { ...s, pub: pub! };
}

async function dumpDb(): Promise<string> {
  const [publications, attempts, logs, notifications, audits, channels, offers] = await Promise.all([
    prisma.publication.findMany(),
    prisma.publicationAttempt.findMany(),
    prisma.systemLog.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.publishingChannel.findMany(),
    prisma.offer.findMany(),
  ]);
  return JSON.stringify({ publications, attempts, logs, notifications, audits, channels, offers });
}

describe('SENT somente com confirmação do provedor (regra inegociável nº 3)', () => {
  it('confirmed=true => SENT com id externo, tentativa registrada e oferta PUBLISHED', async () => {
    const ch = await webhookCh();
    const { pub, offer, link } = await queued(ch);
    const adapter = scriptedAdapter([confirmed('wamid.123')]);
    const out = await sendPublication(pub.id, sendDeps(adapter));
    expect(out).toMatchObject({ status: 'SENT', externalMessageId: 'wamid.123', attemptsCount: 1, lockedAt: null, lastError: null });
    expect(out.sentAt).toBeInstanceOf(Date);
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({ idempotencyKey: `${offer.id}:${ch.id}` });
    expect(adapter.calls[0]!.text).toContain(link!.url);
    expect(adapter.calls[0]!.imageUrl).toBe('https://http2.mlstatic.com/D_NQ_NP_2.jpg');
    const attempts = await attemptsOf(pub.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ success: true, httpStatus: 200, error: null });
    expect(attempts[0]!.finishedAt).toBeInstanceOf(Date);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('PUBLISHED');
  });

  it('ok=true mas confirmed=false (resposta sem id) NUNCA vira SENT: fica FAILED e a tentativa é registrada como falha', async () => {
    const ch = await webhookCh();
    const { pub, offer } = await queued(ch);
    const out = await sendPublication(pub.id, sendDeps(scriptedAdapter([notConfirmed()])));
    expect(out.status).toBe('FAILED');
    expect(out).toMatchObject({ sentAt: null, externalMessageId: null, attemptsCount: 1, lockedAt: null });
    expect(out.lastError).toMatch(/sem id/);
    const [att] = await attemptsOf(pub.id);
    expect(att).toMatchObject({ success: false, httpStatus: 200 });
    expect(att!.error).toMatch(/sem id/);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });

  it('ok=false, confirmed=true (resultado incoerente) também não vira SENT', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, sendDeps(scriptedAdapter([{ ok: false, confirmed: true, error: 'incoerente' }])));
    expect(out.status).toBe('FAILED');
    expect(out.sentAt).toBeNull();
  });

  it('o adaptador lançar exceção => falha de rede registrada, FAILED (nunca SENT)', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, sendDeps(scriptedAdapter([new Error('ECONNRESET socket hang up')])));
    expect(out.status).toBe('FAILED');
    expect(out.lastError).toMatch(/Falha de rede/);
    expect((await attemptsOf(pub.id))[0]).toMatchObject({ success: false });
  });

  it('publicação já SENT não é reenviada (idempotente) e CANCELLED/DEAD/MANUAL_READY/SENDING também não', async () => {
    const ch = await webhookCh();
    const adapter = scriptedAdapter([confirmed()]);
    for (const status of ['SENT', 'CANCELLED', 'DEAD', 'MANUAL_READY', 'SENDING'] as const) {
      const s = await seedOffer();
      const p = await seedPublication(s.offer, ch, s.link, { status, ...(status === 'SENT' ? { sentAt: ago(DAY) } : {}) });
      const out = await sendPublication(p.id, sendDeps(adapter));
      expect(out.status).toBe(status);
    }
    expect(adapter.calls).toHaveLength(0);
  });

  it('publicação inexistente => NotFoundError', async () => {
    await expect(sendPublication('nao-existe', sendDeps(scriptedAdapter([confirmed()])))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('idempotência do envio (regra inegociável nº 4) com servidor simulado (sim)', () => {
  let sim: SimServer;
  beforeEach(async () => {
    sim = await startSim(async (_hit, res) => {
      await new Promise((r) => setTimeout(r, 150)); // janela larga para a corrida
      reply(res, 200, { id: 'recv-1' });
    });
    return async () => {
      await sim.close();
    };
  });

  it('duas chamadas concorrentes de sendPublication => exatamente 1 envio ao simulador', async () => {
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const { pub } = await queued(ch);
    const [a, b] = await Promise.all([sendPublication(pub.id, { now: NOW, source: null }), sendPublication(pub.id, { now: NOW, source: null })]);
    expect(sim.hits).toHaveLength(1);
    expect([a.status, b.status]).toContain('SENT');
    const final = await reload(pub.id);
    expect(final).toMatchObject({ status: 'SENT', attemptsCount: 1, externalMessageId: 'recv-1' });
    expect(await attemptsOf(pub.id)).toHaveLength(1);
  });

  it('dez chamadas concorrentes (sendPublication + processDue em paralelo) => ainda 1 envio', async () => {
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const { pub } = await queued(ch);
    await Promise.all([
      ...Array.from({ length: 8 }, () => sendPublication(pub.id, { now: NOW, source: null })),
      processDue(NOW, { source: null }),
      processDue(NOW, { source: null }),
    ]);
    expect(sim.hits).toHaveLength(1);
    expect(await attemptsOf(pub.id)).toHaveLength(1);
    expect((await reload(pub.id)).status).toBe('SENT');
  });

  it('enviar de novo depois de SENT não toca o simulador', async () => {
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const { pub } = await queued(ch);
    await sendPublication(pub.id, { now: NOW, source: null });
    await sendPublication(pub.id, { now: NOW, source: null });
    await processDue(NOW, { source: null });
    expect(sim.hits).toHaveLength(1);
  });

  it('o webhook real recebe corpo assinado (HMAC verificável com o segredo da credencial) e a chave de idempotência', async () => {
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const { pub, offer, link } = await queued(ch);
    await sendPublication(pub.id, { now: NOW, source: null });
    const hit = sim.hits[0]!;
    expect(hit.method).toBe('POST');
    const sig = String(hit.headers['x-signature']);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(hmacVerify(hit.body, WH_SECRET, sig.slice('sha256='.length))).toBe(true);
    expect(hit.headers['x-idempotency-key']).toBe(`${offer.id}:${ch.id}`);
    const body = hit.json();
    expect(body).toMatchObject({ event: 'offer.publish', idempotencyKey: `${offer.id}:${ch.id}`, publication: { offerId: offer.id, channelId: ch.id } });
    expect(body.text).toContain(link!.url);
    expect(hit.body).not.toContain(WH_SECRET);
  });
});

describe('tentativas, backoff exponencial e DEAD', () => {
  it('BACKOFF_MS = 1min, 5min, 15min, 1h, 4h, 12h (a última repete)', () => {
    expect(BACKOFF_MS).toEqual([MIN, 5 * MIN, 15 * MIN, HOUR, 4 * HOUR, 12 * HOUR]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 99].map(backoffMs)).toEqual([MIN, MIN, 5 * MIN, 15 * MIN, HOUR, 4 * HOUR, 12 * HOUR, 12 * HOUR, 12 * HOUR]);
  });

  it('cada falha consome uma tentativa e agenda o próximo envio com o backoff da sequência; a última => DEAD', async () => {
    await updateSettings({ publishing: { maxAttempts: 6 } });
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const adapter = scriptedAdapter([failure({ error: 'HTTP 500 do provedor' })]);
    const expected = [MIN, 5 * MIN, 15 * MIN, HOUR, 4 * HOUR];
    for (const [i, wait] of expected.entries()) {
      const out = await sendPublication(pub.id, sendDeps(adapter));
      expect(out.status, `tentativa ${i + 1}`).toBe('FAILED');
      expect(out.attemptsCount).toBe(i + 1);
      expect(near(out.scheduledFor, wait), `espera após a tentativa ${i + 1}`).toBe(true);
      expect(out.lockedAt).toBeNull();
      expect(out.lastError).toMatch(/HTTP 500/);
    }
    const last = await sendPublication(pub.id, sendDeps(adapter));
    expect(last).toMatchObject({ status: 'DEAD', attemptsCount: 6, scheduledFor: null });
    const attempts = await attemptsOf(pub.id);
    expect(attempts).toHaveLength(6);
    expect(attempts.every((a) => !a.success && a.finishedAt !== null && a.httpStatus === 500)).toBe(true);
  });

  it('Retry-After do provedor maior que o backoff prevalece; menor é ignorado; absurdo é limitado a 6h', async () => {
    const ch = await webhookCh();
    const cases: [number, number][] = [
      [30 * MIN, 30 * MIN],
      [10_000, MIN],
      [48 * HOUR, 6 * HOUR],
    ];
    for (const [retryAfterMs, expectedWait] of cases) {
      const { pub } = await queued(ch);
      const out = await sendPublication(pub.id, sendDeps(scriptedAdapter([failure({ httpStatus: 429, error: 'limite', retryAfterMs })])));
      expect(out.status).toBe('FAILED');
      expect(near(out.scheduledFor, expectedWait), `retryAfter=${retryAfterMs}`).toBe(true);
      await prisma.publication.update({ where: { id: pub.id }, data: { status: 'CANCELLED' } });
    }
  });

  it('esgotar maxAttempts => DEAD + notificação publication_dead + item na fila dead-letter + log ERROR; oferta volta a APPROVED', async () => {
    await updateSettings({ publishing: { maxAttempts: 3 } });
    const ch = await webhookCh();
    const { pub, offer } = await queued(ch, { title: 'Cafeteira Italiana 6 Xícaras' });
    const adapter = scriptedAdapter([failure({ error: 'HTTP 503 indisponível' })]);
    expect((await sendPublication(pub.id, sendDeps(adapter))).status).toBe('FAILED');
    expect((await sendPublication(pub.id, sendDeps(adapter))).status).toBe('FAILED');
    expect(await prisma.notification.count()).toBe(0);
    const dead = await sendPublication(pub.id, sendDeps(adapter));
    expect(dead).toMatchObject({ status: 'DEAD', attemptsCount: 3, scheduledFor: null, lockedAt: null });
    expect(dead.lastError).toMatch(/503/);

    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `pub-dead:${pub.id}` } });
    expect(note).toMatchObject({ type: 'publication_dead', level: 'ERROR', readAt: null });
    expect(note.body).toMatch(/Cafeteira Italiana/);
    expect(note.body).toMatch(/3 vezes/);

    const job = await getQueue('dead-letter').getJob(`dead-${pub.id}`);
    expect(job).toBeTruthy();
    expect(job!.data).toMatchObject({ publicationId: pub.id, offerId: offer.id, channelId: ch.id, channelName: 'Webhook', productTitle: 'Cafeteira Italiana 6 Xícaras', attempts: 3 });
    expect(job!.data.error).toMatch(/503/);
    expect(new Date(job!.data.deadAt).getTime()).toBeGreaterThan(0);

    expect(await prisma.systemLog.count({ where: { level: 'ERROR', scope: 'publishing', message: { contains: 'esgotada' } } })).toBe(1);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('APPROVED');
  });

  it('DEAD não é pego pelo tick; retryPublication recoloca na fila com tentativas zeradas e histórico preservado', async () => {
    await updateSettings({ publishing: { maxAttempts: 1 } });
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    expect((await sendPublication(pub.id, sendDeps(scriptedAdapter([failure()])))).status).toBe('DEAD');
    const ok = scriptedAdapter([confirmed()]);
    expect(await processDue(new Date(Date.now() + DAY), { source: null, createAdapter: () => ok })).toMatchObject({ sent: 0 });
    expect(ok.calls).toHaveLength(0);

    const retried = await retryPublication(pub.id, (await adminUser()).id);
    expect(retried).toMatchObject({ status: 'PENDING', attemptsCount: 0, lastError: null, scheduledFor: null });
    expect((await sendPublication(pub.id, sendDeps(ok))).status).toBe('SENT');
    expect(await attemptsOf(pub.id)).toHaveLength(2); // histórico da falha + sucesso
    expect(await prisma.auditLog.count({ where: { action: 'publication.retry', entityId: pub.id } })).toBe(1);
  });

  it('erro permanente não retenta: DEAD já na primeira tentativa (com notificação), e o tick não reenvia', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const adapter = scriptedAdapter([failure({ httpStatus: 400, permanent: true, error: 'Telegram 400: chat not found' })]);
    const out = await sendPublication(pub.id, sendDeps(adapter));
    expect(out).toMatchObject({ status: 'DEAD', attemptsCount: 1, scheduledFor: null });
    expect((await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `pub-dead:${pub.id}` } })).body).toMatch(/erro permanente/);
    expect(await getQueue('dead-letter').getJob(`dead-${pub.id}`)).toBeTruthy();
    await processDue(new Date(Date.now() + DAY), { source: null, createAdapter: () => adapter });
    expect(adapter.calls).toHaveLength(1);
  });

  it('o tick só reenvia FAILED depois do horário do backoff', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const adapter = scriptedAdapter([failure(), confirmed()]);
    expect((await sendPublication(pub.id, sendDeps(adapter))).status).toBe('FAILED');
    const due = (await reload(pub.id)).scheduledFor!;

    const early = await processDue(new Date(due.getTime() - 30_000), { source: null, createAdapter: () => adapter });
    expect(early).toMatchObject({ sent: 0, failed: 0 });
    expect(adapter.calls).toHaveLength(1);

    const onTime = await processDue(new Date(due.getTime() + 1000), { source: null, createAdapter: () => adapter });
    expect(onTime).toMatchObject({ sent: 1 });
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[1]!.idempotencyKey).toBe(adapter.calls[0]!.idempotencyKey); // mesma chave em toda retentativa
    expect(await reload(pub.id)).toMatchObject({ status: 'SENT', attemptsCount: 2 });
  });

  it('erros gravados (lastError, tentativa, log, notificação) nunca carregam tokens do provedor', async () => {
    await updateSettings({ publishing: { maxAttempts: 1 } });
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const dirty = `falhou em https://api.telegram.org/bot${TG_TOKEN}/sendMessage com Bearer ${WA_TOKEN} e access_token=${WA_TOKEN}`;
    const out = await sendPublication(pub.id, sendDeps(scriptedAdapter([failure({ permanent: true, error: dirty, response: { authorization: `Bearer ${WA_TOKEN}`, description: dirty } })])));
    expect(out.status).toBe('DEAD');
    expect(leaks(await dumpDb())).toEqual([]);
    expect(out.lastError).toContain('[REDACTED]');
  });
});

describe('authRequired: canal pausado, alerta e nenhuma tentativa consumida', () => {
  it('401/403 do provedor => canal AUTH_REQUIRED + notificação; a publicação volta à fila SEM consumir tentativa', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const adapter = scriptedAdapter([failure({ httpStatus: 401, authRequired: true, permanent: true, error: 'Telegram 401: Unauthorized' })]);
    const out = await sendPublication(pub.id, sendDeps(adapter));
    expect(out).toMatchObject({ status: 'PENDING', attemptsCount: 0, lockedAt: null });
    expect(out.lastError).toMatch(/401/);
    const channel = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(channel.status).toBe('AUTH_REQUIRED');
    expect(channel.statusDetail).toMatch(/401/);
    expect(channel.lastCheckedAt).toBeInstanceOf(Date);
    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `channel-auth:${ch.id}` } });
    expect(note).toMatchObject({ type: 'integration_auth_required', level: 'ERROR', readAt: null });
    expect(await prisma.notification.count({ where: { type: 'publication_dead' } })).toBe(0);
    expect(await getQueue('dead-letter').getJobCounts('waiting', 'delayed', 'completed')).toEqual({ waiting: 0, delayed: 0, completed: 0 });
    expect((await attemptsOf(pub.id))[0]).toMatchObject({ success: false, httpStatus: 401 });
  });

  it('com o canal AUTH_REQUIRED o tick não envia (nem alimenta) e novos enqueues são bloqueados; ao reconectar, volta a enviar', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    const adapter = scriptedAdapter([failure({ httpStatus: 403, authRequired: true, permanent: true, error: 'sem permissão' }), confirmed()]);
    await sendPublication(pub.id, sendDeps(adapter));
    expect(adapter.calls).toHaveLength(1);

    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 0, failed: 0 });
    expect(adapter.calls).toHaveLength(1);
    const other = await seedOffer();
    await expect(enqueueOffer(other.offer.id, { channelId: ch.id }, enqueueDeps)).rejects.toMatchObject({ blockCode: 'CHANNEL_DISABLED' });

    await prisma.publishingChannel.update({ where: { id: ch.id }, data: { status: 'CONNECTED' } });
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 1 });
    expect((await reload(pub.id)).status).toBe('SENT');
  });

  it('o alerta de autenticação é deduplicado enquanto não for lido', async () => {
    const ch = await webhookCh();
    const a = await queued(ch);
    const adapter = scriptedAdapter([failure({ httpStatus: 401, authRequired: true, error: 'x' })]);
    await sendPublication(a.pub.id, sendDeps(adapter));
    await prisma.publishingChannel.update({ where: { id: ch.id }, data: { status: 'CONNECTED' } });
    await sendPublication(a.pub.id, sendDeps(adapter));
    expect(await prisma.notification.count({ where: { type: 'integration_auth_required' } })).toBe(1);
  });

  it('credencial ausente no canal => AUTH_REQUIRED + notificação; envio adiado (CHANNEL_DISABLED), adaptador nunca chamado', async () => {
    const ch = await seedChannel('WEBHOOK', { config: { url: 'https://hooks.exemplo.test/x' }, credentialId: null });
    const { pub } = await queued(ch);
    await expect(sendPublication(pub.id, { now: NOW, source: null })).rejects.toMatchObject({ blockCode: 'CHANNEL_DISABLED' });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('AUTH_REQUIRED');
    const back = await reload(pub.id);
    expect(back).toMatchObject({ status: 'PENDING', attemptsCount: 0, lockedAt: null });
    expect(back.scheduledFor!.getTime()).toBe(NOW.getTime() + 5 * MIN);
    expect(await prisma.notification.count({ where: { type: 'integration_auth_required' } })).toBe(1);
    expect(await attemptsOf(pub.id)).toHaveLength(0);
  });

  it('configuração do canal inválida => canal em ERROR + notificação integration_error (não é problema de credencial)', async () => {
    const cred = await seedCredential('webhook', { secret: WH_SECRET });
    const ch = await seedChannel('WEBHOOK', { config: { url: 'ftp://nao-e-http' }, credentialId: cred.id });
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    await expect(sendPublication(pub.id, { now: NOW, source: null })).rejects.toBeInstanceOf(PublishBlockedError);
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('ERROR');
    expect(await prisma.notification.count({ where: { type: 'integration_error' } })).toBe(1);
    expect((await reload(pub.id)).status).toBe('PENDING');
  });
});

describe('travas aplicadas NO MOMENTO do envio', () => {
  it('link invalidado depois de enfileirar => PublishBlockedError NO_VALIDATED_LINK, nada enviado, volta à fila adiada', async () => {
    const ch = await webhookCh();
    const { pub, link } = await queued(ch);
    await prisma.affiliateLink.update({ where: { id: link!.id }, data: { status: 'INVALID' } });
    const adapter = scriptedAdapter([confirmed()]);
    await expect(sendPublication(pub.id, sendDeps(adapter))).rejects.toMatchObject({ blockCode: 'NO_VALIDATED_LINK' });
    expect(adapter.calls).toHaveLength(0);
    const back = await reload(pub.id);
    expect(back).toMatchObject({ status: 'PENDING', lockedAt: null, attemptsCount: 0 });
    expect(back.scheduledFor!.getTime()).toBe(NOW.getTime() + 10 * MIN);
    expect(back.lastError).toMatch(/link de afiliado validado/);
    expect(await attemptsOf(pub.id)).toHaveLength(0);
  });

  it('o tick conta como "skipped" a publicação travada por link ausente e não chama o provedor', async () => {
    const ch = await webhookCh();
    const { pub, link } = await queued(ch);
    await prisma.affiliateLink.update({ where: { id: link!.id }, data: { status: 'PENDING' } });
    const adapter = scriptedAdapter([confirmed()]);
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 0, skipped: 1 });
    expect(adapter.calls).toHaveLength(0);
    expect((await reload(pub.id)).status).toBe('PENDING');
  });

  it('produto suspenso depois de enfileirar => SUSPENDED_PRODUCT e adiamento', async () => {
    const ch = await webhookCh();
    const { pub, product } = await queued(ch);
    await prisma.product.update({ where: { id: product.id }, data: { status: 'SUSPENDED', suspendReason: 'dado inconsistente' } });
    const adapter = scriptedAdapter([confirmed()]);
    await expect(sendPublication(pub.id, sendDeps(adapter))).rejects.toMatchObject({ blockCode: 'SUSPENDED_PRODUCT' });
    expect(adapter.calls).toHaveLength(0);
    expect((await reload(pub.id)).status).toBe('PENDING');
  });

  it('canal desabilitado depois de enfileirar => CHANNEL_DISABLED', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    await prisma.publishingChannel.update({ where: { id: ch.id }, data: { enabled: false } });
    const adapter = scriptedAdapter([confirmed()]);
    await expect(sendPublication(pub.id, sendDeps(adapter))).rejects.toMatchObject({ blockCode: 'CHANNEL_DISABLED' });
    expect(adapter.calls).toHaveLength(0);
    expect((await reload(pub.id)).status).toBe('PENDING');
  });

  it('oferta rejeitada/expirada depois de enfileirar => publicação CANCELLED sem enviar', async () => {
    const ch = await webhookCh();
    for (const status of ['REJECTED', 'EXPIRED', 'DISCOVERED'] as const) {
      const { pub, offer } = await queued(ch);
      await prisma.offer.update({ where: { id: offer.id }, data: { status } });
      const adapter = scriptedAdapter([confirmed()]);
      const out = await sendPublication(pub.id, sendDeps(adapter));
      expect(out.status, status).toBe('CANCELLED');
      expect(adapter.calls).toHaveLength(0);
      expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe(status);
    }
  });

  it('preço subiu na revalidação => oferta EXPIRED, publicação CANCELLED (e as demais da oferta), nada enviado', async () => {
    const ch = await webhookCh();
    const manual = await seedManualChannel();
    const { pub, offer } = await queued(ch, { priceCents: 10000 });
    await enqueueOffer(offer.id, { channelId: manual.id, force: true }, enqueueDeps);
    const adapter = scriptedAdapter([confirmed()]);
    const out = await sendPublication(pub.id, sendDeps(adapter, { source: new PriceSource(() => ({ priceCents: 12000 })) }));
    expect(out.status).toBe('CANCELLED');
    expect(out.lastError).toMatch(/Oferta expirada: preço subiu/);
    expect(adapter.calls).toHaveLength(0);
    const row = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(row.status).toBe('EXPIRED');
    expect(await prisma.publication.count({ where: { offerId: offer.id, status: 'CANCELLED' } })).toBe(2);
  });

  it('preço caiu na revalidação => envia o preço NOVO e atualiza a oferta (desconto verificado recalculado)', async () => {
    const ch = await webhookCh();
    const { pub, offer } = await queued(ch, { priceCents: 14000, originalPriceCents: 20000, discountVerified: true });
    const adapter = scriptedAdapter([confirmed()]);
    const out = await sendPublication(pub.id, sendDeps(adapter, { source: new PriceSource(() => ({ priceCents: 10000 })) }));
    expect(out.status).toBe('SENT');
    expect(adapter.calls[0]!.text).toContain('100,00');
    expect(adapter.calls[0]!.text).toMatch(/50%/);
    expect(adapter.calls[0]!.text).not.toContain('140,00');
    expect(await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ priceCents: 10000, discountPct: 50, savingsCents: 10000 });
  });

  it('falha ao consultar a fonte => adia 5 min (STALE_PRICE), sem expirar a oferta nem consumir tentativa', async () => {
    const ch = await webhookCh();
    const { pub, offer } = await queued(ch);
    const adapter = scriptedAdapter([confirmed()]);
    await expect(sendPublication(pub.id, sendDeps(adapter, { source: new PriceSource(() => new Error('ML fora do ar')) }))).rejects.toMatchObject({ blockCode: 'STALE_PRICE' });
    expect(adapter.calls).toHaveLength(0);
    const back = await reload(pub.id);
    expect(back).toMatchObject({ status: 'PENDING', attemptsCount: 0 });
    expect(back.scheduledFor!.getTime()).toBe(NOW.getTime() + 5 * MIN);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });
});

describe('fila manual (Modo B): nunca SENT automático', () => {
  it('canal WHATSAPP_MANUAL_QUEUE gera MANUAL_READY com a mensagem pronta; sendPublication não envia nada', async () => {
    const ch = await seedManualChannel();
    const { pub, link, offer } = await queued(ch);
    expect(pub).toMatchObject({ status: 'MANUAL_READY', sentAt: null, externalMessageId: null, attemptsCount: 0 });
    expect(pub.messageText).toContain(link!.url);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('MANUAL_READY');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });

  it('uma Publication PENDING de canal manual (ex.: legado) é preparada como MANUAL_READY — sem tentativa e sem SENT', async () => {
    const ch = await seedManualChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out).toMatchObject({ status: 'MANUAL_READY', sentAt: null, externalMessageId: null, lockedAt: null });
    expect(out.messageText).toContain(s.link!.url);
    expect(await attemptsOf(pub.id)).toHaveLength(0);
  });

  it('a fila manual é alimentada mesmo com autoPublish desligado, mas nunca envia; canais automáticos não recebem nada', async () => {
    const manual = await seedManualChannel();
    const auto = await webhookCh();
    const s = await seedOffer({ score: 80 });
    const adapter = scriptedAdapter([confirmed()]);
    const stats = await processDue(NOW, { source: null, createAdapter: () => adapter });
    expect(stats).toMatchObject({ sent: 0, manualReady: 1 });
    expect(adapter.calls).toHaveLength(0);
    expect((await prisma.publication.findMany({ where: { offerId: s.offer.id } })).map((p) => [p.channelId, p.status])).toEqual([[manual.id, 'MANUAL_READY']]);
    expect(await prisma.publication.count({ where: { channelId: auto.id } })).toBe(0);
  });

  it('markManualSent: MANUAL_READY => SENT (confirmação humana), com auditoria, oferta PUBLISHED e idempotente', async () => {
    const ch = await seedManualChannel();
    const { pub, offer } = await queued(ch);
    const user = await prisma.user.create({ data: { email: 'adm@teste.local', passwordHash: 'x' } });
    const sent = await markManualSent(pub.id, user.id, '10.0.0.1');
    expect(sent).toMatchObject({ status: 'SENT', externalMessageId: `manual:${user.id}`, attemptsCount: 1, lastError: null });
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('PUBLISHED');
    expect(await prisma.auditLog.count({ where: { action: 'publication.mark-sent', entityId: pub.id } })).toBe(1);
    const again = await markManualSent(pub.id, user.id);
    expect(again.status).toBe('SENT');
    expect(again.attemptsCount).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'publication.mark-sent', entityId: pub.id } })).toBe(1);
  });

  it.each(['PENDING', 'CANCELLED', 'FAILED'] as const)('markManualSent em publicação %s => 409 PUBLICATION_NOT_MANUAL_READY', async (status) => {
    const ch = await seedManualChannel();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status });
    const err = await markManualSent(pub.id, 'u').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).code).toBe('PUBLICATION_NOT_MANUAL_READY');
    expect((await reload(pub.id)).status).toBe(status);
  });

  it('markManualSent de um envio AUTOMÁTICO já SENT (id do provedor) não é tratado como manual', async () => {
    const ch = await webhookCh();
    const { pub } = await queued(ch);
    await sendPublication(pub.id, sendDeps(scriptedAdapter([confirmed('wamid.9')])));
    await expect(markManualSent(pub.id, 'u')).rejects.toMatchObject({ code: 'PUBLICATION_NOT_MANUAL_READY' });
  });

  it('a fila manual exige link validado: sem link nada é enfileirado (nem pelo tick)', async () => {
    const ch = await seedManualChannel();
    const s = await seedOffer({ link: 'PENDING' });
    await expect(enqueueOffer(s.offer.id, { channelId: ch.id }, enqueueDeps)).rejects.toMatchObject({ blockCode: 'NO_VALIDATED_LINK' });
    await processDue(NOW, { source: null });
    expect(await prisma.publication.count()).toBe(0);
  });

  it('retryPublication de item manual cancelado NÃO ressuscita a publicação se o link deixou de ser validado', async () => {
    const ch = await seedManualChannel();
    const { pub, link } = await queued(ch);
    await cancelPublication(pub.id);
    await prisma.affiliateLink.update({ where: { id: link!.id }, data: { status: 'INVALID' } });
    await expect(retryPublication(pub.id, (await adminUser()).id)).rejects.toMatchObject({ blockCode: 'NO_VALIDATED_LINK' });
    expect((await reload(pub.id)).status).toBe('CANCELLED');
  });

  it('retryPublication de item manual também respeita oferta não aprovada e produto suspenso', async () => {
    const ch = await seedManualChannel();
    const a = await queued(ch);
    await cancelPublication(a.pub.id);
    await prisma.offer.update({ where: { id: a.offer.id }, data: { status: 'REJECTED' } });
    await expect(retryPublication(a.pub.id, (await adminUser()).id)).rejects.toMatchObject({ blockCode: 'OFFER_NOT_APPROVED' });

    const b = await queued(ch);
    await cancelPublication(b.pub.id);
    await prisma.product.update({ where: { id: b.product.id }, data: { status: 'SUSPENDED' } });
    await expect(retryPublication(b.pub.id, (await adminUser()).id)).rejects.toMatchObject({ blockCode: 'SUSPENDED_PRODUCT' });
  });

  it('retryPublication de item manual válido volta a MANUAL_READY', async () => {
    const ch = await seedManualChannel();
    const { pub } = await queued(ch);
    await cancelPublication(pub.id);
    const out = await retryPublication(pub.id, (await adminUser()).id);
    expect(out.status).toBe('MANUAL_READY');
  });

  it('itens da fila manual com mais de 24h expiram (o preço pode ter mudado)', async () => {
    const ch = await seedManualChannel();
    const old = await seedOffer();
    const fresh = await seedOffer();
    const pOld = await seedPublication(old.offer, ch, old.link, { status: 'MANUAL_READY', createdAt: ago(25 * HOUR, new Date()) });
    const pFresh = await seedPublication(fresh.offer, ch, fresh.link, { status: 'MANUAL_READY', createdAt: ago(23 * HOUR, new Date()) });
    expect(await expireStaleManualQueue(new Date())).toBe(1);
    expect(await reload(pOld.id)).toMatchObject({ status: 'CANCELLED' });
    expect((await reload(pOld.id)).lastError).toMatch(/Expirada após 24h/);
    expect((await reload(pFresh.id)).status).toBe('MANUAL_READY');
  });
});

describe('processDue: alimentação automática, ordem e ritmo', () => {
  it('canal automático só recebe ofertas com autoPublish ligado e score >= minScoreToPublish', async () => {
    const ch = await webhookCh();
    const low = await seedOffer({ score: 70 });
    const high = await seedOffer({ score: 80 });
    const adapter = scriptedAdapter([confirmed()]);
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 0 });
    expect(await prisma.publication.count()).toBe(0); // autoPublish desligado

    await updateSettings({ publishing: { autoPublish: true } });
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 1 });
    expect(await prisma.publication.count({ where: { offerId: low.offer.id } })).toBe(0);
    expect(await prisma.publication.findFirstOrThrow({ where: { offerId: high.offer.id, channelId: ch.id } })).toMatchObject({ status: 'SENT' });
  });

  it('envia as melhores ofertas primeiro', async () => {
    const ch = await webhookCh();
    const mk = (score: number) => seedOffer({ score, title: `Produto S${score}` });
    const [a, b, c] = [await mk(60), await mk(90), await mk(75)];
    for (const s of [a, b, c]) await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    const adapter = scriptedAdapter([confirmed()]);
    const stats = await processDue(NOW, { source: null, createAdapter: () => adapter });
    expect(stats).toMatchObject({ sent: 3, failed: 0, skipped: 0 });
    // o texto de cada mensagem traz o título do produto
    const order = adapter.calls.map((p) => /S(60|75|90)/.exec(p.text)?.[1]);
    expect(order).toEqual(['90', '75', '60']);
  });

  it('respeita o limite por hora no próprio tick (o excedente fica pendente, contado como skipped)', async () => {
    const ch = await webhookCh();
    await updateSettings({ publishing: { maxPerHour: 1 } });
    const pubs = [];
    for (const score of [80, 85, 90]) {
      const s = await seedOffer({ score });
      pubs.push(await seedPublication(s.offer, ch, s.link, { status: 'PENDING' }));
    }
    const adapter = scriptedAdapter([confirmed()]);
    const stats = await processDue(NOW, { source: null, createAdapter: () => adapter });
    expect(stats).toMatchObject({ sent: 1, skipped: 2 });
    expect(adapter.calls).toHaveLength(1);
    expect(await prisma.publication.count({ where: { status: 'PENDING' } })).toBe(2);
  });

  it('respeita o intervalo mínimo entre envios do canal', async () => {
    const ch = await webhookCh();
    await updateSettings({ publishing: { minIntervalMinutes: 30 } });
    for (const score of [80, 90]) {
      const s = await seedOffer({ score });
      await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    }
    const adapter = scriptedAdapter([confirmed()]);
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 1, skipped: 1 });
    expect(adapter.calls).toHaveLength(1);
    // o envio grava sentAt com o relógio real: a segunda rodada precisa estar 31 min depois dele
    expect(await processDue(new Date(Date.now() + 31 * MIN), { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 1 });
    expect(adapter.calls).toHaveLength(2);
  });

  it('no horário de silêncio nada é enviado nem alimentado', async () => {
    await updateSettings({ publishing: { quietHours: { enabled: true }, autoPublish: true } });
    const ch = await webhookCh();
    const s = await seedOffer({ score: 90, discoveredAt: new Date('2026-10-01T05:00:00.000Z') });
    const pending = await seedOffer({ score: 95 });
    await seedPublication(pending.offer, ch, pending.link, { status: 'PENDING' });
    const adapter = scriptedAdapter([confirmed()]);
    const night = new Date('2026-10-01T06:00:00.000Z'); // 03:00 em SP
    const stats = await processDue(night, { source: null, createAdapter: () => adapter });
    expect(stats).toMatchObject({ sent: 0, skipped: 1 });
    expect(adapter.calls).toHaveLength(0);
    expect(await prisma.publication.count({ where: { offerId: s.offer.id } })).toBe(0);
  });

  it('SCHEDULED só sai quando scheduledFor vence', async () => {
    const ch = await webhookCh();
    const s = await seedOffer();
    const when = new Date(NOW.getTime() + HOUR);
    await seedPublication(s.offer, ch, s.link, { status: 'SCHEDULED', scheduledFor: when });
    const adapter = scriptedAdapter([confirmed()]);
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 0 });
    expect(await processDue(new Date(when.getTime() + 1), { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 1 });
  });

  it('ofertas com mais de 24h, sem link validado ou de produto suspenso não são alimentadas automaticamente', async () => {
    await updateSettings({ publishing: { autoPublish: true } });
    await webhookCh();
    await seedOffer({ score: 90, discoveredAt: ago(25 * HOUR) });
    await seedOffer({ score: 90, link: null });
    await seedOffer({ score: 90, link: 'INVALID' });
    await seedOffer({ score: 90, productStatus: 'SUSPENDED' });
    await seedOffer({ score: 90, offerStatus: 'REJECTED' });
    const adapter = scriptedAdapter([confirmed()]);
    expect(await processDue(NOW, { source: null, createAdapter: () => adapter })).toMatchObject({ sent: 0, failed: 0 });
    expect(await prisma.publication.count()).toBe(0);
  });

  it('falhas contam em `failed` e a publicação segue FAILED com backoff', async () => {
    const ch = await webhookCh();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'PENDING' });
    const stats = await processDue(NOW, { source: null, createAdapter: () => scriptedAdapter([failure()]) });
    expect(stats).toMatchObject({ sent: 0, failed: 1 });
    expect((await reload(pub.id)).status).toBe('FAILED');
  });
});

describe('failPublication: protegido contra corrida com a recuperação', () => {
  it('só age se a publicação ainda está SENDING (SENT não é rebaixada)', async () => {
    const ch = await webhookCh();
    const s = await seedOffer();
    const pub = await seedPublication(s.offer, ch, s.link, { status: 'SENT', sentAt: ago(HOUR), externalMessageId: 'x' });
    const ctx = { id: pub.id, offerId: s.offer.id, channelId: ch.id, attemptsCount: 0, channel: { name: ch.name }, offer: { product: { title: 'x' } } };
    expect(await failPublication(ctx, 'tarde demais', {})).toBeNull();
    expect((await reload(pub.id)).status).toBe('SENT');
    expect(await prisma.notification.count()).toBe(0);
  });

  it('addToDeadLetter é idempotente por publicação (jobId dead-<id>)', async () => {
    const data = { publicationId: 'p1', offerId: 'o', channelId: 'c', channelName: 'n', productTitle: 't', attempts: 3, error: 'e', deadAt: NOW.toISOString() };
    await addToDeadLetter(data);
    await addToDeadLetter(data);
    expect(await getQueue('dead-letter').getJobCounts('waiting')).toEqual({ waiting: 1 });
  });
});

describe('envio via servidores simulados (sim) com os adaptadores reais', () => {
  let sims: SimServer[] = [];
  const track = async (h: Parameters<typeof startSim>[0]) => {
    const s = await startSim(h);
    sims.push(s);
    return s;
  };
  afterAll(async () => {
    await Promise.all(sims.map((s) => s.close()));
  });

  it('Telegram: foto com legenda => SENT com message_id; o token vai só na URL e não sobra em nenhum registro', async () => {
    const sim = await track((_h, res) => reply(res, 200, { ok: true, result: { message_id: 4242 } }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out).toMatchObject({ status: 'SENT', externalMessageId: '4242' });
    expect(sim.hits[0]!.url).toBe(`/bot${TG_TOKEN}/sendPhoto`);
    expect(sim.hits[0]!.json()).toMatchObject({ chat_id: '@canal_teste', parse_mode: 'HTML' });
    expect(sim.hits[0]!.json().caption.length).toBeLessThanOrEqual(1024);
    expect(leaks(await dumpDb())).toEqual([]);
  });

  it('Telegram: 200 sem message_id => NÃO confirmado => FAILED (retentativa), nunca SENT', async () => {
    const sim = await track((_h, res) => reply(res, 200, { ok: true, result: {} }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('FAILED');
    expect(out.sentAt).toBeNull();
    expect((await attemptsOf(pub.id))[0]).toMatchObject({ success: false, httpStatus: 200 });
    expect(out.lastError).toMatch(/NÃO confirmado/);
  });

  it('Telegram: 401 que ecoa o token no corpo => canal AUTH_REQUIRED sem vazar o token em lugar nenhum', async () => {
    const sim = await track((_h, res) => reply(res, 401, { ok: false, error_code: 401, description: `Unauthorized: bot${TG_TOKEN} revogado` }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out).toMatchObject({ status: 'PENDING', attemptsCount: 0 });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('AUTH_REQUIRED');
    expect(leaks(await dumpDb())).toEqual([]);
  });

  it('Telegram: 429 com retry_after => FAILED com espera >= retry_after (10 min)', async () => {
    const sim = await track((_h, res) => reply(res, 429, { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 600 } }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('FAILED');
    expect(out.attemptsCount).toBe(1);
    expect(near(out.scheduledFor, 10 * MIN)).toBe(true);
  });

  it('Telegram: 500 => FAILED com o backoff padrão (1 min) e tentativa registrada com HTTP 500', async () => {
    const sim = await track((_h, res) => reply(res, 500, { ok: false, error_code: 500, description: 'Internal Server Error' }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('FAILED');
    expect(near(out.scheduledFor, MIN)).toBe(true);
    expect((await attemptsOf(pub.id))[0]).toMatchObject({ success: false, httpStatus: 500 });
  });

  it('WhatsApp Cloud (Groups API): sucesso com messages[0].id; token só no header Authorization', async () => {
    const sim = await track((_h, res) => reply(res, 200, { messaging_product: 'whatsapp', messages: [{ id: 'wamid.HBgM' }] }));
    const ch = await seedWhatsAppChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out).toMatchObject({ status: 'SENT', externalMessageId: 'wamid.HBgM' });
    const hit = sim.hits[0]!;
    expect(hit.url).toBe('/v23.0/1234567890/messages');
    expect(hit.headers.authorization).toBe(`Bearer ${WA_TOKEN}`);
    expect(hit.json()).toMatchObject({ messaging_product: 'whatsapp', recipient_type: 'group', to: 'grupo-teste-1' });
    expect(leaks(await dumpDb())).toEqual([]);
  });

  it('WhatsApp Cloud: 403 => AUTH_REQUIRED; resposta 200 sem id => FAILED', async () => {
    let mode: 'forbidden' | 'noid' = 'forbidden';
    const sim = await track((_h, res) => (mode === 'forbidden' ? reply(res, 403, { error: { message: `Permissão negada para ${WA_TOKEN}`, code: 200 } }) : reply(res, 200, { messages: [] })));
    const ch = await seedWhatsAppChannel(sim.url);
    const a = await queued(ch);
    expect(await sendPublication(a.pub.id, { now: NOW, source: null })).toMatchObject({ status: 'PENDING' });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('AUTH_REQUIRED');

    await prisma.publishingChannel.update({ where: { id: ch.id }, data: { status: 'CONNECTED' } });
    mode = 'noid';
    expect((await sendPublication(a.pub.id, { now: NOW, source: null })).status).toBe('FAILED');
    expect(leaks(await dumpDb())).toEqual([]);
  });

  it('receptor que ECOA o segredo do webhook (cru, sem formato reconhecível) não o faz parar em nenhuma tabela', async () => {
    const sim = await track((_h, res) => reply(res, 500, { error: `assinatura ${WH_SECRET} inválida` }));
    const ch = await seedWebhookChannel(`${sim.url}/hook`);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('FAILED');
    expect(out.lastError).toContain('[REDACTED]');
    expect(leaks(await dumpDb())).toEqual([]);
    const cred = await prisma.integrationCredential.findFirstOrThrow();
    expect(cred.encrypted).not.toContain(WH_SECRET); // criptografada em repouso
  });

  it('Telegram que ecoa o token "pelado" (sem o prefixo bot) no erro permanente também não vaza', async () => {
    const sim = await track((_h, res) => reply(res, 400, { ok: false, error_code: 400, description: `Bad Request: token ${TG_TOKEN} não pode postar` }));
    const ch = await seedTelegramChannel(sim.url);
    const { pub } = await queued(ch);
    const out = await sendPublication(pub.id, { now: NOW, source: null });
    expect(out.status).toBe('DEAD');
    expect(leaks(await dumpDb())).toEqual([]);
    expect(leaks(await getQueue('dead-letter').getJobs(['waiting']).then((j) => j.map((x) => x.data)))).toEqual([]);
  });
});
