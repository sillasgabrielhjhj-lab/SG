/**
 * Apoio dos testes do módulo de PUBLICAÇÃO (SOMENTE testes): servidores HTTP simulados em localhost, fábricas de
 * dados (oferta aprovada + link validado + canal) e adaptadores/fontes roteirizados. Todos os dados são fictícios.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ChannelStatus, ChannelType, Offer, PublishingChannel, Product, AffiliateLink, Category, IntegrationCredential, Prisma } from '@prisma/client';
import type { FetchContext, HealthResult, NormalizedListing, OfferSource, PublishPayload, PublisherAdapter, SendResult } from '../../src/domain/types.js';
import { encryptJson } from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/db.js';
import { mkListing } from './discovery-fixtures.js';

// ---------- relógio ----------

/** 12:00 em São Paulo (fora do horário de silêncio 00:00–07:00). */
export const NOW = new Date('2026-10-01T15:00:00.000Z');
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const ago = (ms: number, from: Date = NOW): Date => new Date(from.getTime() - ms);
export const after = (ms: number, from: Date = NOW): Date => new Date(from.getTime() + ms);

// ---------- segredos de teste (nunca podem aparecer em logs/erros/respostas) ----------

export const TG_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';
export const WA_TOKEN = 'EAAGm0PX4ZCpsBAKtestTOKENabcdefghijklmnop12345';
export const WH_SECRET = 'whsec_0123456789abcdef0123456789';
export const ALL_SECRETS = [TG_TOKEN, TG_TOKEN.split(':')[1]!, WA_TOKEN, WH_SECRET] as const;

/** Procura qualquer segredo conhecido em um valor arbitrário (serializado em JSON). */
export function leaks(value: unknown, secrets: readonly string[] = ALL_SECRETS): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return secrets.filter((s) => text.includes(s));
}

// ---------- servidor HTTP simulado ----------

export interface SimHit {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: () => any;
}
export interface SimServer {
  server: http.Server;
  port: number;
  /** http://127.0.0.1:<porta> */
  url: string;
  hits: SimHit[];
  close(): Promise<void>;
}
export type SimHandler = (hit: SimHit, res: http.ServerResponse) => void | Promise<void>;

/** Sobe um servidor em 127.0.0.1 (porta efêmera). O handler recebe o corpo já lido; não responder = pendurar. */
export async function startSim(handler: SimHandler): Promise<SimServer> {
  const hits: SimHit[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const hit: SimHit = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body, json: () => JSON.parse(body) };
      hits.push(hit);
      void Promise.resolve(handler(hit, res)).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    hits,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

export function reply(res: http.ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): void {
  const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(payload);
}

// ---------- dados ----------

let seq = 0;
const next = (): number => ++seq;

export const VALID_LINK_URL = 'https://meli.la/2aBcDeF';

export async function seedCategory(over: Partial<Omit<Category, 'id'>> = {}): Promise<Category> {
  const n = next();
  return prisma.category.create({
    data: { key: `cat-pub-${n}`, name: `Categoria ${n}`, mlCategoryIds: ['MLB1055'], searchTerms: [], enabled: true, relevance: 80, ...over },
  });
}

export interface SeedOfferOptions {
  /** Reaproveita o produto (várias ofertas da mesma família). */
  product?: Product;
  categoryId?: string | null;
  productStatus?: string;
  suspendedUntil?: Date | null;
  suspendReason?: string | null;
  familyKey?: string;
  title?: string;
  offerStatus?: Offer['status'];
  priceCents?: number;
  originalPriceCents?: number | null;
  discountVerified?: boolean;
  score?: number;
  kind?: Offer['kind'];
  discoveredAt?: Date;
  expiresAt?: Date | null;
  /** 'VALIDATED' (padrão) | 'PENDING' | 'INVALID' | null (sem link) */
  link?: AffiliateLink['status'] | null;
  linkUrl?: string;
  imageUrl?: string | null;
}
export interface SeededOffer {
  product: Product;
  offer: Offer;
  link: AffiliateLink | null;
}

/** Oferta APROVADA de um produto ATIVO com link de afiliado VALIDADO (tudo ajustável). */
export async function seedOffer(o: SeedOfferOptions = {}): Promise<SeededOffer> {
  const n = next();
  const externalId = `MLB${String(2000000000 + n)}`;
  const product =
    o.product ??
    (await prisma.product.create({
      data: {
        source: 'mercadolivre',
        externalId,
        familyKey: o.familyKey ?? `fam-pub-${n}`,
        title: o.title ?? `Fone Bluetooth JBL Tune 520BT ${n}`,
        permalink: `https://produto.mercadolivre.com.br/MLB-${externalId.slice(3)}-fone-bluetooth-_JM`,
        thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_1.jpg',
        imageUrl: o.imageUrl === undefined ? 'https://http2.mlstatic.com/D_NQ_NP_2.jpg' : o.imageUrl,
        categoryId: o.categoryId ?? null,
        status: o.productStatus ?? 'ACTIVE',
        suspendedUntil: o.suspendedUntil ?? null,
        suspendReason: o.suspendReason ?? null,
      },
    }));
  const offer = await prisma.offer.create({
    data: {
      productId: product.id,
      status: o.offerStatus ?? 'APPROVED',
      tier: 'EXCELLENT',
      kind: o.kind ?? 'COMMON',
      score: o.score ?? 85,
      priceCents: o.priceCents ?? 10000,
      originalPriceCents: o.originalPriceCents ?? null,
      discountPct: null,
      savingsCents: null,
      discountVerified: o.discountVerified ?? false,
      discoveredAt: o.discoveredAt ?? ago(HOUR),
      expiresAt: o.expiresAt ?? null,
    },
  });
  let link: AffiliateLink | null = null;
  const wantLink = o.link === undefined ? 'VALIDATED' : o.link;
  if (wantLink) {
    link = await prisma.affiliateLink.create({
      data: {
        productId: product.id,
        url: o.linkUrl ?? VALID_LINK_URL,
        kind: 'MANUAL',
        status: wantLink,
        validatedAt: wantLink === 'VALIDATED' ? NOW : null,
        validationNote: 'validado (teste)',
      },
    });
  }
  return { product, offer, link };
}

export async function seedCredential(provider: string, values: Record<string, string>, name = `cred-${next()}`): Promise<IntegrationCredential> {
  return prisma.integrationCredential.create({
    data: { provider, name, encrypted: encryptJson(values), hint: '••••test', status: 'UNKNOWN' },
  });
}

export interface SeedChannelOptions {
  name?: string;
  enabled?: boolean;
  status?: ChannelStatus;
  config?: Record<string, unknown>;
  credentialId?: string | null;
}

export async function seedChannel(type: ChannelType, o: SeedChannelOptions = {}): Promise<PublishingChannel> {
  return prisma.publishingChannel.create({
    data: {
      type,
      name: o.name ?? `Canal ${type} ${next()}`,
      enabled: o.enabled ?? true,
      status: o.status ?? 'CONNECTED',
      config: (o.config ?? {}) as Prisma.InputJsonValue,
      credentialId: o.credentialId ?? null,
    },
  });
}

export const seedManualChannel = (o: SeedChannelOptions = {}): Promise<PublishingChannel> => seedChannel('WHATSAPP_MANUAL_QUEUE', { name: 'Fila manual', ...o });

/** Webhook REAL (adaptador de produção) apontando para um simulador local. */
export async function seedWebhookChannel(url: string, o: SeedChannelOptions = {}): Promise<PublishingChannel> {
  const cred = o.credentialId ? null : await seedCredential('webhook', { secret: WH_SECRET });
  return seedChannel('WEBHOOK', { name: 'Webhook sim', config: { url }, credentialId: o.credentialId ?? cred!.id, ...o });
}

export async function seedTelegramChannel(baseUrl: string, o: SeedChannelOptions = {}): Promise<PublishingChannel> {
  const cred = o.credentialId ? null : await seedCredential('telegram', { botToken: TG_TOKEN });
  return seedChannel('TELEGRAM', { name: 'Telegram sim', config: { chatId: '@canal_teste', baseUrl }, credentialId: o.credentialId ?? cred!.id, ...o });
}

export async function seedWhatsAppChannel(baseUrl: string, o: SeedChannelOptions = {}): Promise<PublishingChannel> {
  const cred = o.credentialId ? null : await seedCredential('whatsapp_cloud', { accessToken: WA_TOKEN });
  return seedChannel('WHATSAPP_CLOUD_GROUP', {
    name: 'WhatsApp Cloud sim',
    config: { phoneNumberId: '1234567890', groupId: 'grupo-teste-1', baseUrl },
    credentialId: o.credentialId ?? cred!.id,
    ...o,
  });
}

// ---------- publicações ----------

export interface SeedPublicationOptions {
  status?: Prisma.PublicationCreateInput['status'];
  sentAt?: Date | null;
  scheduledFor?: Date | null;
  lockedAt?: Date | null;
  attemptsCount?: number;
  externalMessageId?: string | null;
  createdAt?: Date;
  messageText?: string;
}

export async function seedPublication(offer: Offer, channel: PublishingChannel, link: AffiliateLink | null, o: SeedPublicationOptions = {}) {
  return prisma.publication.create({
    data: {
      offerId: offer.id,
      channelId: channel.id,
      status: o.status ?? 'PENDING',
      template: offer.kind,
      messageText: o.messageText ?? `Oferta de teste ${offer.id}\n${link?.url ?? VALID_LINK_URL}`,
      imageUrl: null,
      affiliateLinkId: link?.id ?? 'sem-link',
      idempotencyKey: `${offer.id}:${channel.id}`,
      sentAt: o.sentAt ?? null,
      scheduledFor: o.scheduledFor ?? null,
      lockedAt: o.lockedAt ?? null,
      attemptsCount: o.attemptsCount ?? 0,
      externalMessageId: o.externalMessageId ?? null,
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
}

// ---------- adaptador roteirizado ----------

export const confirmed = (id = 'msg-1'): SendResult => ({ ok: true, confirmed: true, externalMessageId: id, httpStatus: 200, response: { id } });
export const notConfirmed = (): SendResult => ({ ok: true, confirmed: false, httpStatus: 200, error: 'resposta sem id: não confirmado' });
export const failure = (over: Partial<SendResult> = {}): SendResult => ({ ok: false, confirmed: false, httpStatus: 500, error: 'HTTP 500 do provedor', ...over });

export type Step = SendResult | Error | ((p: PublishPayload) => SendResult | Promise<SendResult>);

export interface ScriptedAdapter extends PublisherAdapter {
  calls: PublishPayload[];
}

/** Adaptador automático cujas respostas são roteirizadas (a última se repete). */
export function scriptedAdapter(steps: Step[], opts: { type?: PublisherAdapter['type']; delayMs?: number } = {}): ScriptedAdapter {
  const calls: PublishPayload[] = [];
  return {
    type: opts.type ?? 'WEBHOOK',
    format: 'plain',
    automatic: true,
    calls,
    async send(payload) {
      const step = steps[Math.min(calls.length, steps.length - 1)]!;
      calls.push(payload);
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (step instanceof Error) throw step;
      return typeof step === 'function' ? step(payload) : step;
    },
    async healthCheck(): Promise<HealthResult> {
      return { ok: true, status: 'CONNECTED', detail: 'roteirizado (teste)' };
    },
  };
}

// ---------- fonte de preços (revalidação) ----------

/** Fonte cujo fetchListing é decidido pelo teste (null = indisponível; Error = falha de consulta). */
export class PriceSource implements OfferSource {
  readonly name = 'price-sim';
  calls: string[] = [];
  constructor(private readonly handler: (externalId: string) => Partial<NormalizedListing> | null | Error) {}
  async fetchListings(_ctx: FetchContext): Promise<NormalizedListing[]> {
    return [];
  }
  async fetchListing(externalId: string): Promise<NormalizedListing | null> {
    this.calls.push(externalId);
    const r = this.handler(externalId);
    if (r instanceof Error) throw r;
    return r === null ? null : mkListing({ externalId, ...r });
  }
  async healthCheck(): Promise<HealthResult> {
    return { ok: true, status: 'CONNECTED', detail: 'simulada' };
  }
}

/** Espera até `fn` devolver algo "verdadeiro" (polling), para efeitos assíncronos (workers). */
export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 10_000, everyMs = 50): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`waitFor: tempo esgotado após ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
