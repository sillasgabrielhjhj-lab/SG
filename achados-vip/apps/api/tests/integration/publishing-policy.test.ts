/**
 * Publicação: TODAS as travas de política avaliadas por enqueueOffer (camada de serviço, não só UI).
 * Banco real de teste; sem rede (a revalidação de preço usa uma fonte injetada).
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { NotFoundError, PublishBlockedError } from '../../src/lib/errors.js';
import { cancelPublication, enqueueOffer, type EnqueueOptions } from '../../src/services/publishing.js';
import { setOfferSourceProvider } from '../../src/services/policy.js';
import { updateSettings } from '../../src/services/settings.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { DAY, HOUR, MIN, NOW, PriceSource, ago, seedCategory, seedChannel, seedManualChannel, seedOffer, seedPublication } from '../helpers/publishing-fixtures.js';

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});
afterEach(() => setOfferSourceProvider(null));

const deps = { now: NOW, source: null } as const;
const enqueue = (offerId: string, opts?: EnqueueOptions, at: Date = NOW) => enqueueOffer(offerId, opts, { now: at, source: null });

async function blocked(p: Promise<unknown>): Promise<PublishBlockedError> {
  const err = await p.then(
    () => {
      throw new Error('esperava PublishBlockedError, mas a chamada resolveu');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PublishBlockedError);
  const e = err as PublishBlockedError;
  expect(e.status).toBe(409);
  expect(e.code).toBe(e.blockCode);
  return e;
}

const webhook = () => seedChannel('WEBHOOK', { name: 'Webhook', config: { url: 'https://hooks.exemplo.test/x' } });
const loose = { minIntervalMinutes: 0, maxPerHour: 100, maxPerDay: 100, maxPerCategoryPerDay: 100 };
const setPolicy = (p: Record<string, unknown>) => updateSettings({ publishing: p });

describe('travas duras: link de afiliado VALIDADO (regra inegociável nº 1)', () => {
  it('sem nenhum link => NO_VALIDATED_LINK, nada é criado e a oferta continua aprovada', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ link: null });
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('NO_VALIDATED_LINK');
    expect(await prisma.publication.count()).toBe(0);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('APPROVED');
  });

  it.each(['PENDING', 'INVALID'] as const)('link %s não libera a publicação (nem em canal manual, nem com force)', async (status) => {
    const auto = await webhook();
    const manual = await seedManualChannel();
    const { offer } = await seedOffer({ link: status });
    for (const opts of [{ channelId: auto.id }, { channelId: manual.id }, {}, { channelId: auto.id, force: true }, { force: true }]) {
      expect((await blocked(enqueue(offer.id, opts))).blockCode).toBe('NO_VALIDATED_LINK');
    }
    expect(await prisma.publication.count()).toBe(0);
  });

  it('link VALIDATED cujo host deixou de ser permitido também bloqueia (defesa em profundidade)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ linkUrl: 'https://loja-falsa.example.com/produto?aff=1' });
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }))).blockCode).toBe('NO_VALIDATED_LINK');
    // e um link http (sem TLS) também
    const { offer: o2 } = await seedOffer({ linkUrl: 'http://meli.la/2aBcDeF' });
    expect((await blocked(enqueue(o2.id, { channelId: ch.id }))).blockCode).toBe('NO_VALIDATED_LINK');
  });

  it('com link VALIDATED cria a publicação com o link na mensagem e vincula o AffiliateLink usado', async () => {
    const ch = await webhook();
    const { offer, link } = await seedOffer();
    const [pub] = await enqueue(offer.id, { channelId: ch.id });
    expect(pub).toMatchObject({ status: 'PENDING', offerId: offer.id, channelId: ch.id, affiliateLinkId: link!.id, idempotencyKey: `${offer.id}:${ch.id}`, attemptsCount: 0 });
    expect(pub!.messageText).toContain(link!.url);
    expect(pub!.imageUrl).toBe('https://http2.mlstatic.com/D_NQ_NP_2.jpg');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });

  it('usa o link VALIDADO mais recente quando há links PENDING/INVALID e antigos', async () => {
    const ch = await webhook();
    const { offer, product, link } = await seedOffer();
    await prisma.affiliateLink.create({ data: { productId: product.id, url: 'https://meli.la/pendente', status: 'PENDING' } });
    await prisma.affiliateLink.create({ data: { productId: product.id, url: 'https://meli.la/invalido', status: 'INVALID' } });
    const [pub] = await enqueue(offer.id, { channelId: ch.id });
    expect(pub!.affiliateLinkId).toBe(link!.id);
    expect(pub!.messageText).not.toContain('pendente');
    expect(pub!.messageText).not.toContain('invalido');
  });
});

describe('travas duras: oferta e produto', () => {
  it.each(['DISCOVERED', 'REJECTED', 'SUSPENDED'] as const)('oferta %s => OFFER_NOT_APPROVED (inclusive com force)', async (offerStatus) => {
    const ch = await webhook();
    const { offer } = await seedOffer({ offerStatus });
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }))).blockCode).toBe('OFFER_NOT_APPROVED');
    expect((await blocked(enqueue(offer.id, { channelId: ch.id, force: true }))).blockCode).toBe('OFFER_NOT_APPROVED');
    expect(await prisma.publication.count()).toBe(0);
  });

  it('oferta EXPIRED ou com expiresAt vencido => STALE_PRICE', async () => {
    const ch = await webhook();
    const a = await seedOffer({ offerStatus: 'EXPIRED' });
    expect((await blocked(enqueue(a.offer.id, { channelId: ch.id }))).blockCode).toBe('STALE_PRICE');
    const b = await seedOffer({ expiresAt: ago(MIN) });
    expect((await blocked(enqueue(b.offer.id, { channelId: ch.id }))).blockCode).toBe('STALE_PRICE');
    const c = await seedOffer({ expiresAt: new Date(NOW.getTime() + HOUR) });
    await expect(enqueue(c.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it.each(['APPROVED', 'QUEUED', 'PUBLISHED'] as const)('oferta %s pode ser publicada', async (offerStatus) => {
    const ch = await webhook();
    const { offer } = await seedOffer({ offerStatus });
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it.each([
    ['status SUSPENDED', { productStatus: 'SUSPENDED', suspendReason: 'preço inconsistente' }],
    ['status UNAVAILABLE', { productStatus: 'UNAVAILABLE' }],
    ['suspendedUntil no futuro', { suspendedUntil: new Date(NOW.getTime() + DAY) }],
  ] as const)('produto suspenso (%s) => SUSPENDED_PRODUCT, mesmo com force', async (_label, product) => {
    const ch = await webhook();
    const { offer } = await seedOffer(product);
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('SUSPENDED_PRODUCT');
    expect(err.message).toMatch(/Publicação bloqueada/);
    expect((await blocked(enqueue(offer.id, { channelId: ch.id, force: true }))).blockCode).toBe('SUSPENDED_PRODUCT');
    expect(await prisma.publication.count()).toBe(0);
  });

  it('suspensão que já passou (suspendedUntil no passado) não bloqueia', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ suspendedUntil: ago(HOUR) });
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('oferta inexistente => NotFoundError (404)', async () => {
    await expect(enqueue('nao-existe')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('travas do canal', () => {
  it('canal desabilitado => CHANNEL_DISABLED; canal inexistente => 404', async () => {
    const off = await seedChannel('WEBHOOK', { enabled: false, config: { url: 'https://hooks.exemplo.test/x' } });
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: off.id }));
    expect(err.blockCode).toBe('CHANNEL_DISABLED');
    expect(err.message).toMatch(/desabilitado/);
    await expect(enqueue(offer.id, { channelId: 'canal-inexistente' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sem nenhum canal habilitado => CHANNEL_DISABLED', async () => {
    await seedChannel('WEBHOOK', { enabled: false, config: { url: 'https://hooks.exemplo.test/x' } });
    const { offer } = await seedOffer();
    expect((await blocked(enqueue(offer.id))).blockCode).toBe('CHANNEL_DISABLED');
  });

  it('canal pausado por autenticação (AUTH_REQUIRED) não recebe publicações', async () => {
    const ch = await seedChannel('WEBHOOK', { status: 'AUTH_REQUIRED', config: { url: 'https://hooks.exemplo.test/x' } });
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('CHANNEL_DISABLED');
    expect(err.message).toMatch(/autenticação necessária/);
  });

  it('sem channelId: publica só nos canais permitidos e só lança se NENHUM puder receber', async () => {
    const on = await webhook();
    const off = await seedChannel('WEBHOOK', { enabled: false, name: 'Desligado', config: { url: 'https://hooks.exemplo.test/y' } });
    const paused = await seedChannel('WEBHOOK', { status: 'AUTH_REQUIRED', name: 'Pausado', config: { url: 'https://hooks.exemplo.test/z' } });
    const { offer } = await seedOffer();
    const pubs = await enqueue(offer.id);
    expect(pubs.map((p) => p.channelId)).toEqual([on.id]);
    expect(await prisma.publication.count({ where: { channelId: { in: [off.id, paused.id] } } })).toBe(0);
  });
});

describe('horário de silêncio', () => {
  const at = (iso: string) => new Date(iso);

  it('dentro do silêncio (03:00 em São Paulo) => OUT_OF_WINDOW com a próxima janela (07:00 local)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }, at('2026-10-01T06:00:00.000Z')));
    expect(err.blockCode).toBe('OUT_OF_WINDOW');
    expect(err.message).toMatch(/silêncio/i);
    expect((err.details as { nextAllowedAt: string }).nextAllowedAt).toBe('2026-10-01T10:00:00.000Z');
    expect(await prisma.publication.count()).toBe(0);
  });

  it('o fim da janela é exclusivo: 06:59 bloqueia e 07:00 libera', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }, at('2026-10-01T09:59:00.000Z')))).blockCode).toBe('OUT_OF_WINDOW');
    await expect(enqueue(offer.id, { channelId: ch.id }, at('2026-10-01T10:00:00.000Z'))).resolves.toHaveLength(1);
  });

  it('respeita o fuso configurado (10:30Z é 07:30 em SP, mas 06:30 em Manaus)', async () => {
    const ch = await webhook();
    const a = await seedOffer();
    await expect(enqueue(a.offer.id, { channelId: ch.id }, at('2026-10-01T10:30:00.000Z'))).resolves.toHaveLength(1);
    await updateSettings({ publishing: { quietHours: { timezone: 'America/Manaus' } } });
    const b = await seedOffer();
    expect((await blocked(enqueue(b.offer.id, { channelId: ch.id }, at('2026-10-01T10:30:00.000Z')))).blockCode).toBe('OUT_OF_WINDOW');
  });

  it('janela que cruza a meia-noite (22:00–07:00) e silêncio desabilitado', async () => {
    const ch = await webhook();
    await updateSettings({ publishing: { quietHours: { start: '22:00', end: '07:00' } } });
    const a = await seedOffer();
    // 23:30 em SP = 02:30Z do dia seguinte
    expect((await blocked(enqueue(a.offer.id, { channelId: ch.id }, at('2026-10-02T02:30:00.000Z')))).blockCode).toBe('OUT_OF_WINDOW');
    await updateSettings({ publishing: { quietHours: { enabled: false } } });
    await expect(enqueue(a.offer.id, { channelId: ch.id }, at('2026-10-02T02:30:00.000Z'))).resolves.toHaveLength(1);
  });

  it('force (administrador) ignora o silêncio, mas não os demais bloqueios', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    await expect(enqueue(offer.id, { channelId: ch.id, force: true }, at('2026-10-01T06:00:00.000Z'))).resolves.toHaveLength(1);
    expect((await blocked(enqueue(offer.id, { channelId: ch.id, force: true }, at('2026-10-01T06:00:00.000Z')))).blockCode).toBe('DUPLICATE');
  });
});

describe('limites por hora, dia, categoria e intervalo mínimo', () => {
  async function sentBefore(channelId: string, sentAts: Date[], categoryId: string | null = null): Promise<void> {
    const ch = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: channelId } });
    for (const sentAt of sentAts) {
      const s = await seedOffer({ offerStatus: 'PUBLISHED', categoryId });
      await seedPublication(s.offer, ch, s.link, { status: 'SENT', sentAt, externalMessageId: 'x' });
    }
  }

  it('intervalo mínimo: 10 min após a última publicação bloqueia (LIMIT_REACHED); 31 min libera', async () => {
    const ch = await webhook();
    await sentBefore(ch.id, [ago(10 * MIN)]);
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('LIMIT_REACHED');
    expect(err.message).toMatch(/Intervalo mínimo de 30 min/);
    expect((err.details as { nextAllowedAt: string }).nextAllowedAt).toBe(new Date(NOW.getTime() + 20 * MIN).toISOString());

    await prisma.publication.updateMany({ data: { sentAt: ago(31 * MIN) } });
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('intervalo mínimo 0 desliga a trava de intervalo', async () => {
    const ch = await webhook();
    await sentBefore(ch.id, [ago(MIN)]);
    await setPolicy({ minIntervalMinutes: 0 });
    const { offer } = await seedOffer();
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('limite por hora: 2 envios na última hora bloqueiam; um deles com 61 min já não conta', async () => {
    const ch = await webhook();
    await setPolicy({ ...loose, maxPerHour: 2 });
    await sentBefore(ch.id, [ago(10 * MIN), ago(20 * MIN)]);
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('LIMIT_REACHED');
    expect(err.message).toMatch(/2 publicação\(ões\) por hora/);

    await prisma.publication.updateMany({ where: { sentAt: ago(20 * MIN) }, data: { sentAt: ago(61 * MIN) } });
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('o enfileiramento também conta as publicações RESERVADAS (limita o tamanho da fila)', async () => {
    const ch = await webhook();
    await setPolicy({ ...loose, maxPerHour: 2 });
    const [a, b, c] = [await seedOffer(), await seedOffer(), await seedOffer()];
    await enqueue(a.offer.id, { channelId: ch.id });
    await enqueue(b.offer.id, { channelId: ch.id });
    expect((await blocked(enqueue(c.offer.id, { channelId: ch.id }))).blockCode).toBe('LIMIT_REACHED');
    expect(await prisma.publication.count()).toBe(2);
  });

  it('limite por dia civil (fuso de SP): 2 envios hoje bloqueiam; envios de ontem não contam', async () => {
    const ch = await webhook();
    await setPolicy({ ...loose, maxPerDay: 2 });
    await sentBefore(ch.id, [ago(2 * HOUR), ago(3 * HOUR)]);
    const { offer } = await seedOffer();
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('LIMIT_REACHED');
    expect(err.message).toMatch(/2 publicação\(ões\) por dia/);

    // 23:30 de ontem em SP = 02:30Z de hoje... (03:00Z é a meia-noite local de 01/10)
    await prisma.publication.updateMany({ data: { sentAt: new Date('2026-10-01T02:30:00.000Z') } });
    await expect(enqueue(offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('limite diário da CATEGORIA (Category.dailyLimit) vale só para ela; outra categoria segue livre', async () => {
    const ch = await webhook();
    await setPolicy(loose);
    const limited = await seedCategory({ dailyLimit: 1 });
    const other = await seedCategory({ dailyLimit: null });
    await sentBefore(ch.id, [ago(2 * HOUR)], limited.id);
    const inLimited = await seedOffer({ categoryId: limited.id });
    const inOther = await seedOffer({ categoryId: other.id });
    const err = await blocked(enqueue(inLimited.offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('LIMIT_REACHED');
    expect(err.message).toMatch(/na categoria/);
    await expect(enqueue(inOther.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('sem dailyLimit na categoria vale settings.publishing.maxPerCategoryPerDay', async () => {
    const ch = await webhook();
    await setPolicy({ ...loose, maxPerCategoryPerDay: 2 });
    const cat = await seedCategory({ dailyLimit: null });
    await sentBefore(ch.id, [ago(2 * HOUR), ago(3 * HOUR)], cat.id);
    const { offer } = await seedOffer({ categoryId: cat.id });
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }))).blockCode).toBe('LIMIT_REACHED');
  });

  it('o ritmo é POR CANAL: o limite de um canal não bloqueia o outro (sem channelId, entra só onde cabe)', async () => {
    const a = await webhook();
    const b = await seedChannel('WEBHOOK', { name: 'Webhook B', config: { url: 'https://hooks.exemplo.test/b' } });
    await sentBefore(a.id, [ago(5 * MIN)]);
    const { offer } = await seedOffer();
    const pubs = await enqueue(offer.id);
    expect(pubs.map((p) => p.channelId)).toEqual([b.id]);
    // explicitamente no canal A continua bloqueado
    const other = await seedOffer();
    expect((await blocked(enqueue(other.offer.id, { channelId: a.id }))).blockCode).toBe('LIMIT_REACHED');
  });

  it('fila manual segue o mesmo ritmo no próprio canal (MANUAL_READY conta como liberada) e não consome o dos automáticos', async () => {
    const manual = await seedManualChannel();
    const auto = await webhook();
    const a = await seedOffer();
    const b = await seedOffer();
    const [m] = await enqueue(a.offer.id, { channelId: manual.id });
    expect(m!.status).toBe('MANUAL_READY');
    expect((await blocked(enqueue(b.offer.id, { channelId: manual.id }))).blockCode).toBe('LIMIT_REACHED'); // intervalo mínimo no canal manual
    await expect(enqueue(b.offer.id, { channelId: auto.id })).resolves.toHaveLength(1); // o automático não foi consumido
  });

  it('force ignora o RITMO (intervalo e limites) mas nunca a duplicidade', async () => {
    const ch = await webhook();
    await sentBefore(ch.id, [ago(MIN), ago(2 * MIN)]);
    const { offer } = await seedOffer();
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }))).blockCode).toBe('LIMIT_REACHED');
    await expect(enqueue(offer.id, { channelId: ch.id, force: true })).resolves.toHaveLength(1);
    expect((await blocked(enqueue(offer.id, { channelId: ch.id, force: true }))).blockCode).toBe('DUPLICATE');
  });
});

describe('republicação (mesma família no mesmo canal)', () => {
  async function previouslySent(channelId: string, sentAgo: number, priceCents = 10000) {
    const ch = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: channelId } });
    const first = await seedOffer({ priceCents, offerStatus: 'PUBLISHED' });
    await seedPublication(first.offer, ch, first.link, { status: 'SENT', sentAt: ago(sentAgo), externalMessageId: 'x' });
    return first;
  }

  it('publicada há 2 dias e queda adicional de só 5% => bloqueia (DUPLICATE com motivo)', async () => {
    const ch = await webhook();
    const first = await previouslySent(ch.id, 2 * DAY);
    const again = await seedOffer({ product: first.product, priceCents: 9500 });
    const err = await blocked(enqueue(again.offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('DUPLICATE');
    expect(err.message).toMatch(/menos de 7 dia/);
    expect((err.details as { reason: string }).reason).toMatch(/queda adicional \(5%\) é menor que 10%/);
    expect(await prisma.publication.count({ where: { offerId: again.offer.id } })).toBe(0);
  });

  it('queda adicional de 11% libera a republicação; 10% exatos também (limite inclusivo)', async () => {
    const ch = await webhook();
    await setPolicy({ minIntervalMinutes: 0 });
    const first = await previouslySent(ch.id, 2 * DAY);
    const at11 = await seedOffer({ product: first.product, priceCents: 8900 });
    await expect(enqueue(at11.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
    await prisma.publication.updateMany({ where: { offerId: at11.offer.id }, data: { status: 'CANCELLED' } });
    const at10 = await seedOffer({ product: first.product, priceCents: 9000 });
    await expect(enqueue(at10.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('preço IGUAL ou MAIOR que o publicado dentro do prazo => bloqueia', async () => {
    const ch = await webhook();
    const first = await previouslySent(ch.id, 3 * DAY);
    for (const price of [10000, 12000]) {
      const o = await seedOffer({ product: first.product, priceCents: price });
      expect((await blocked(enqueue(o.offer.id, { channelId: ch.id }))).blockCode).toBe('DUPLICATE');
    }
  });

  it('passados 7 dias libera mesmo sem queda; 6 dias e 23h ainda bloqueia', async () => {
    const ch = await webhook();
    const first = await previouslySent(ch.id, 7 * DAY - HOUR);
    const o = await seedOffer({ product: first.product, priceCents: 10000 });
    expect((await blocked(enqueue(o.offer.id, { channelId: ch.id }))).blockCode).toBe('DUPLICATE');
    await prisma.publication.updateMany({ where: { offerId: first.offer.id }, data: { sentAt: ago(7 * DAY) } });
    await expect(enqueue(o.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);
  });

  it('os parâmetros vêm das configurações (republishAfterDays=1, queda mínima 50%)', async () => {
    const ch = await webhook();
    const first = await previouslySent(ch.id, 2 * DAY);
    await setPolicy({ republishAfterDays: 1 });
    const o = await seedOffer({ product: first.product, priceCents: 10000 });
    await expect(enqueue(o.offer.id, { channelId: ch.id })).resolves.toHaveLength(1);

    const recent = await previouslySent(ch.id, HOUR);
    await setPolicy({ republishAfterDays: 7, republishMinAdditionalDropPct: 50, minIntervalMinutes: 0 });
    const o2 = await seedOffer({ product: recent.product, priceCents: 7000 }); // -30% < 50%
    expect((await blocked(enqueue(o2.offer.id, { channelId: ch.id }))).blockCode).toBe('DUPLICATE');
  });

  it('a regra é por canal (envio em outro canal não bloqueia) e force a ignora', async () => {
    const a = await webhook();
    const b = await seedChannel('WEBHOOK', { name: 'B', config: { url: 'https://hooks.exemplo.test/b' } });
    const first = await previouslySent(a.id, 2 * DAY);
    const o = await seedOffer({ product: first.product, priceCents: 10000 });
    await expect(enqueue(o.offer.id, { channelId: b.id })).resolves.toHaveLength(1);
    const o2 = await seedOffer({ product: first.product, priceCents: 10000 });
    await setPolicy({ minIntervalMinutes: 0 });
    expect((await blocked(enqueue(o2.offer.id, { channelId: a.id }))).blockCode).toBe('DUPLICATE');
    await expect(enqueue(o2.offer.id, { channelId: a.id, force: true })).resolves.toHaveLength(1);
  });

  it('outra oferta da MESMA família ainda em andamento no canal => DUPLICATE (mesmo produto não entra duas vezes na fila)', async () => {
    const ch = await webhook();
    const first = await seedOffer();
    await enqueue(first.offer.id, { channelId: ch.id });
    await setPolicy({ minIntervalMinutes: 0 });
    const twin = await seedOffer({ product: first.product, priceCents: 8000 });
    const err = await blocked(enqueue(twin.offer.id, { channelId: ch.id }));
    expect(err.message).toMatch(/já está na fila/);
    const otherChannel = await seedChannel('WEBHOOK', { name: 'B', config: { url: 'https://hooks.exemplo.test/b' } });
    await expect(enqueue(twin.offer.id, { channelId: otherChannel.id })).resolves.toHaveLength(1);
  });
});

describe('preço mudou desde a descoberta (revalidação pela fonte injetada) => oferta expira', () => {
  it('preço subiu além da tolerância (2%) => STALE_PRICE, oferta EXPIRED e nada enfileirado', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ priceCents: 10000 });
    const source = new PriceSource(() => ({ priceCents: 11000 }));
    const err = await blocked(enqueueOffer(offer.id, { channelId: ch.id }, { now: NOW, source }));
    expect(err.blockCode).toBe('STALE_PRICE');
    expect(err.message).toMatch(/preço subiu/);
    expect(source.calls).toHaveLength(1);
    const row = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(row.status).toBe('EXPIRED');
    expect(row.decisionNote).toMatch(/^Oferta expirada: preço subiu/);
    expect(await prisma.publication.count()).toBe(0);
    // e continua barrada nas próximas tentativas
    expect((await blocked(enqueue(offer.id, { channelId: ch.id }))).blockCode).toBe('STALE_PRICE');
  });

  it('tolerância de 2%: R$ 102,00 passa; R$ 102,01 expira', async () => {
    const ch = await webhook();
    const a = await seedOffer({ priceCents: 10000 });
    const [pub] = await enqueueOffer(a.offer.id, { channelId: ch.id }, { now: NOW, source: new PriceSource(() => ({ priceCents: 10200 })) });
    expect(pub!.messageText).toContain('102,00');
    await setPolicy({ minIntervalMinutes: 0 });
    const b = await seedOffer({ priceCents: 10000 });
    const err = await blocked(enqueueOffer(b.offer.id, { channelId: ch.id }, { now: NOW, source: new PriceSource(() => ({ priceCents: 10201 })) }));
    expect(err.blockCode).toBe('STALE_PRICE');
  });

  it('preço CAIU: publica com o preço revalidado na mensagem (nunca o antigo)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ priceCents: 10000 });
    const [pub] = await enqueueOffer(offer.id, { channelId: ch.id }, { now: NOW, source: new PriceSource(() => ({ priceCents: 8000 })) });
    expect(pub!.messageText).toContain('80,00');
    expect(pub!.messageText).not.toContain('100,00');
  });

  it('anúncio indisponível (null) ou sem estoque => oferta expira', async () => {
    const ch = await webhook();
    const gone = await seedOffer();
    expect((await blocked(enqueueOffer(gone.offer.id, { channelId: ch.id }, { now: NOW, source: new PriceSource(() => null) }))).blockCode).toBe('STALE_PRICE');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: gone.offer.id } })).decisionNote).toMatch(/indisponível/);
    const empty = await seedOffer();
    const err = await blocked(enqueueOffer(empty.offer.id, { channelId: ch.id }, { now: NOW, source: new PriceSource(() => ({ priceCents: 10000, availableQuantity: 0 })) }));
    expect(err.blockCode).toBe('STALE_PRICE');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: empty.offer.id } })).status).toBe('EXPIRED');
  });

  it('falha ao consultar a fonte NÃO expira a oferta (o envio revalida e adia)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    const source = new PriceSource(() => new Error('rede indisponível'));
    const pubs = await enqueueOffer(offer.id, { channelId: ch.id }, { now: NOW, source });
    expect(pubs).toHaveLength(1);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });

  it('a fonte é consultada UMA vez mesmo com vários canais', async () => {
    await webhook();
    await seedChannel('WEBHOOK', { name: 'B', config: { url: 'https://hooks.exemplo.test/b' } });
    await seedManualChannel();
    const { offer } = await seedOffer();
    const source = new PriceSource(() => ({ priceCents: 10000 }));
    const pubs = await enqueueOffer(offer.id, {}, { now: NOW, source });
    expect(pubs).toHaveLength(3);
    expect(source.calls).toHaveLength(1);
  });

  it('sem `source` nas deps usa a fonte injetada globalmente (setOfferSourceProvider)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ priceCents: 10000 });
    const source = new PriceSource(() => ({ priceCents: 20000 }));
    setOfferSourceProvider(async () => source);
    const err = await blocked(enqueueOffer(offer.id, { channelId: ch.id }, { now: NOW }));
    expect(err.blockCode).toBe('STALE_PRICE');
    expect(source.calls).toEqual([expect.stringMatching(/^MLB/)]);
  });
});

describe('idempotência do enfileiramento', () => {
  it('enqueueOffer duas vezes => 1 Publication (chave offerId:channelId); a segunda lança DUPLICATE', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    await enqueue(offer.id, { channelId: ch.id });
    const err = await blocked(enqueue(offer.id, { channelId: ch.id }));
    expect(err.blockCode).toBe('DUPLICATE');
    expect(err.message).toMatch(/já foi enfileirada ou publicada|já está na fila/);
    const rows = await prisma.publication.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.idempotencyKey).toBe(`${offer.id}:${ch.id}`);
  });

  it('chamadas CONCORRENTES para a mesma oferta/canal => exatamente 1 Publication', async () => {
    const ch = await webhook();
    await setPolicy(loose);
    const { offer } = await seedOffer();
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => enqueue(offer.id, { channelId: ch.id })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(4);
    for (const r of rejected) expect((r.reason as PublishBlockedError).blockCode).toBe('DUPLICATE');
    expect(await prisma.publication.count()).toBe(1);
  });

  it.each(['SENT', 'FAILED', 'DEAD', 'MANUAL_READY', 'SENDING'] as const)('já existe publicação %s => DUPLICATE (inclusive com force)', async (status) => {
    const ch = await webhook();
    const { offer, link } = await seedOffer();
    await seedPublication(offer, ch, link, { status, ...(status === 'SENT' ? { sentAt: ago(10 * DAY) } : {}) });
    expect((await blocked(enqueue(offer.id, { channelId: ch.id, force: true }))).blockCode).toBe('DUPLICATE');
    expect(await prisma.publication.count()).toBe(1);
  });

  it('publicação CANCELLED é reativada (mesma linha/chave), zerando tentativas e erro', async () => {
    const ch = await webhook();
    const { offer, link } = await seedOffer();
    const old = await seedPublication(offer, ch, link, { status: 'CANCELLED', attemptsCount: 3 });
    await prisma.publication.update({ where: { id: old.id }, data: { lastError: 'falhou antes' } });
    const [pub] = await enqueue(offer.id, { channelId: ch.id });
    expect(pub!.id).toBe(old.id);
    expect(pub).toMatchObject({ status: 'PENDING', attemptsCount: 0, lastError: null, lockedAt: null });
    expect(await prisma.publication.count()).toBe(1);
  });

  it('cancelPublication + enqueueOffer reaproveita a linha existente', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer();
    const [first] = await enqueue(offer.id, { channelId: ch.id });
    const cancelled = await cancelPublication(first!.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('APPROVED');
    await setPolicy(loose);
    const [again] = await enqueue(offer.id, { channelId: ch.id });
    expect(again!.id).toBe(first!.id);
  });
});

describe('status criado por canal e agendamento', () => {
  it('canal automático => PENDING (ou SCHEDULED com scheduledFor futuro); canal manual => MANUAL_READY (nunca SENT)', async () => {
    const auto = await webhook();
    const manual = await seedManualChannel();
    const a = await seedOffer();
    const when = new Date(NOW.getTime() + 2 * HOUR);
    const [sched] = await enqueueOffer(a.offer.id, { channelId: auto.id, scheduledFor: when }, deps);
    expect(sched).toMatchObject({ status: 'SCHEDULED' });
    expect(sched!.scheduledFor!.getTime()).toBe(when.getTime());

    const b = await seedOffer();
    const [man] = await enqueueOffer(b.offer.id, { channelId: manual.id, scheduledFor: when }, deps);
    expect(man).toMatchObject({ status: 'MANUAL_READY', sentAt: null, externalMessageId: null });
    expect(man!.scheduledFor!.getTime()).toBe(NOW.getTime());
  });

  it('scheduledFor no passado vira PENDING imediato', async () => {
    const auto = await webhook();
    const { offer } = await seedOffer();
    const [pub] = await enqueueOffer(offer.id, { channelId: auto.id, scheduledFor: ago(HOUR) }, deps);
    expect(pub).toMatchObject({ status: 'PENDING', scheduledFor: null });
  });

  it('vários canais de uma vez: cada um recebe sua publicação com o formato do canal e a oferta fica QUEUED', async () => {
    const auto = await webhook();
    const manual = await seedManualChannel();
    const tg = await seedChannel('TELEGRAM', { name: 'TG', config: { chatId: '@canal_teste' } });
    const { offer } = await seedOffer();
    const pubs = await enqueue(offer.id);
    expect(new Set(pubs.map((p) => p.channelId))).toEqual(new Set([auto.id, manual.id, tg.id]));
    const byChannel = new Map(pubs.map((p) => [p.channelId, p]));
    expect(byChannel.get(manual.id)!.messageText).toMatch(/\*/); // WhatsApp: *negrito*
    expect(byChannel.get(tg.id)!.messageText).toMatch(/<b>/); // Telegram HTML
    expect(byChannel.get(auto.id)!.messageText).not.toMatch(/<b>|\*/); // webhook: texto puro
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('QUEUED');
  });
});

describe('mensagem: só dados verificados', () => {
  it('sem desconto verificado a mensagem mostra só o preço atual (nada de "de/por" nem %)', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ priceCents: 14000, originalPriceCents: 20000, discountVerified: false });
    const [pub] = await enqueue(offer.id, { channelId: ch.id });
    expect(pub!.messageText).toContain('140,00');
    expect(pub!.messageText).not.toContain('200,00');
    expect(pub!.messageText).not.toMatch(/%/);
  });

  it('com desconto verificado mostra o preço original e a % calculada sobre o preço atual', async () => {
    const ch = await webhook();
    const { offer } = await seedOffer({ priceCents: 14000, originalPriceCents: 20000, discountVerified: true });
    const [pub] = await enqueue(offer.id, { channelId: ch.id });
    expect(pub!.messageText).toContain('200,00');
    expect(pub!.messageText).toContain('140,00');
    expect(pub!.messageText).toMatch(/30%/);
  });
});
