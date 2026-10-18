/**
 * Apoio dos testes de afiliados/ofertas/rotas (SOMENTE testes): fetcher falso, fetcher sobre o safeFetch real com
 * resolver falso e fábricas de produto/oferta/link. Todos os dados são fictícios.
 */
import type { AffiliateLink, Offer, Product } from '@prisma/client';
import { prisma } from '../../src/lib/db.js';
import { safeFetch, type ResolvedAddress, type SafeFetchOptions } from '../../src/lib/ssrf.js';
import type { Fetcher } from '../../src/services/affiliate.js';

// ---------- fetchers ----------

export interface FakeFetchStep {
  status?: number;
  /** URL final (padrão: a pedida) */
  url?: string;
  redirects?: string[];
  headers?: Record<string, string>;
  html?: string;
}
export interface FakeFetcher extends Fetcher {
  calls: { url: string; method: string; opts: SafeFetchOptions }[];
}

/** Fetcher falso: o handler decide a resposta (ou devolve/lança um Error) para cada chamada. */
export function fakeFetcher(handler: (url: string, opts: SafeFetchOptions, n: number) => FakeFetchStep | Error): FakeFetcher {
  const calls: FakeFetcher['calls'] = [];
  const fn = (async (url: string, opts: SafeFetchOptions) => {
    calls.push({ url, method: opts.method ?? 'GET', opts });
    const step = handler(url, opts, calls.length);
    if (step instanceof Error) throw step;
    const html = step.html ?? '';
    return {
      status: step.status ?? 200,
      headers: { 'content-type': 'text/html; charset=utf-8', ...(step.headers ?? {}) },
      url: step.url ?? url,
      redirects: step.redirects ?? [],
      text: () => html,
    };
  }) as unknown as FakeFetcher;
  fn.calls = calls;
  return fn;
}

/** Página de produto do ML (simulada) com <link rel="canonical">. */
export const productPage = (mlId: string): string =>
  `<!doctype html><html><head><link rel="canonical" href="https://produto.mercadolivre.com.br/${mlId.replace('MLB', 'MLB-')}-produto-_JM"><title>Produto</title></head><body>ok</body></html>`;

/** URL de página de produto do ML (simulada) para um id. */
export const productUrl = (mlId: string): string => `https://produto.mercadolivre.com.br/${mlId.replace('MLB', 'MLB-')}-produto-simulado-_JM`;

/** Resolver que devolve um IP PÚBLICO fictício (documentação): a validação SSRF passa sem DNS real. */
export const fakePublicResolver = async (): Promise<ResolvedAddress[]> => [{ address: '93.184.216.34', family: 4 }];

/** Fetcher do serviço de afiliados sobre o safeFetch REAL, com resolver falso (use com sim-virtual-hosts + vi.mock). */
export const simFetcher: Fetcher = (url, opts) => safeFetch(url, { ...opts, resolver: fakePublicResolver });

// ---------- dados ----------

let seq = 0;

export interface SeedProductOptions {
  externalId?: string;
  catalogProductId?: string | null;
  title?: string;
  source?: string;
  status?: string;
  categoryId?: string | null;
  familyKey?: string;
}

export async function seedMlProduct(o: SeedProductOptions = {}): Promise<Product> {
  const n = ++seq;
  const externalId = o.externalId ?? `MLB${1000000000 + n}`;
  return prisma.product.create({
    data: {
      source: o.source ?? 'mercadolivre',
      externalId,
      catalogProductId: o.catalogProductId ?? null,
      familyKey: o.familyKey ?? `fam-${externalId}`,
      title: o.title ?? `Produto de teste ${externalId}`,
      permalink: productUrl(externalId),
      thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_1.jpg',
      categoryId: o.categoryId ?? null,
      status: o.status ?? 'ACTIVE',
    },
  });
}

export interface SeedOfferOptions {
  status?: Offer['status'];
  tier?: Offer['tier'];
  kind?: Offer['kind'];
  score?: number;
  priceCents?: number;
  originalPriceCents?: number | null;
  discountPct?: number | null;
  savingsCents?: number | null;
  discountVerified?: boolean;
  couponCode?: string | null;
  discoveredAt?: Date;
  decidedAt?: Date | null;
  expiresAt?: Date | null;
  decidedBy?: string | null;
  installments?: object | null;
}

/** Oferta direta no banco (sem passar pela descoberta). */
export async function seedOfferFor(productId: string, o: SeedOfferOptions = {}): Promise<Offer> {
  return prisma.offer.create({
    data: {
      productId,
      status: o.status ?? 'DISCOVERED',
      tier: o.tier ?? 'EXCELLENT',
      kind: o.kind ?? 'COMMON',
      score: o.score ?? 80,
      priceCents: o.priceCents ?? 10000,
      originalPriceCents: o.originalPriceCents ?? null,
      discountPct: o.discountPct ?? null,
      savingsCents: o.savingsCents ?? null,
      discountVerified: o.discountVerified ?? false,
      couponCode: o.couponCode ?? null,
      discoveredAt: o.discoveredAt ?? new Date(),
      decidedAt: o.decidedAt ?? null,
      decidedBy: o.decidedBy ?? null,
      expiresAt: o.expiresAt === undefined ? new Date(Date.now() + 20 * 3_600_000) : o.expiresAt,
      ...(o.installments ? { installments: o.installments } : {}),
    },
  });
}

export async function seedLinkFor(
  productId: string,
  o: { url?: string; status?: AffiliateLink['status']; validatedAt?: Date | null; note?: string | null; kind?: AffiliateLink['kind'] } = {},
): Promise<AffiliateLink> {
  const status = o.status ?? 'VALIDATED';
  return prisma.affiliateLink.create({
    data: {
      productId,
      url: o.url ?? `https://meli.la/${Math.random().toString(36).slice(2, 9)}`,
      status,
      kind: o.kind ?? 'MANUAL',
      validatedAt: o.validatedAt === undefined ? (status === 'VALIDATED' ? new Date() : null) : o.validatedAt,
      validationNote: o.note ?? (status === 'VALIDATED' ? 'validado (teste)' : null),
    },
  });
}

export async function seedManualChannel(name = 'Fila manual'): Promise<{ id: string }> {
  return prisma.publishingChannel.create({ data: { type: 'WHATSAPP_MANUAL_QUEUE', name, enabled: true, config: {}, status: 'CONNECTED' } });
}
