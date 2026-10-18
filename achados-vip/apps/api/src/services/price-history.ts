/**
 * Histórico de preços (PriceHistory). Base da "referência verificada": o sistema só afirma desconto
 * com o que ele mesmo observou. Dinheiro em centavos.
 */
import type { PriceHistory, Prisma, PrismaClient } from '@prisma/client';
import type { NormalizedListing } from '../domain/types.js';
import { prisma } from '../lib/db.js';
import { addDays, MINUTE_MS } from '../lib/time.js';
import { getSettings } from './settings.js';

type Client = PrismaClient | Prisma.TransactionClient;

/** Observações idênticas (mesmo preço/cupom) dentro desta janela não geram nova linha, só atualizam lastSeenAt. */
export const DEFAULT_DEDUPE_MINUTES = 120;

const SOURCE_LABELS: Record<string, string> = { mercadolivre: 'ml_api', fixture: 'fixture' };
/** Rótulo gravado em PriceHistory.source ("ml_api", "fixture", "manual"). */
export const historySourceLabel = (source: string): string => SOURCE_LABELS[source] ?? source;

export interface RecordOptions {
  dedupeMinutes?: number;
  client?: Client;
}

/** Variação do anúncio (ProductVariant), criada sob demanda. */
export async function getOrCreateVariantId(productId: string, variationExternalId: string, client: Client = prisma): Promise<string> {
  const variant = await client.productVariant.upsert({
    where: { productId_externalId: { productId, externalId: variationExternalId } },
    update: {},
    create: { productId, externalId: variationExternalId },
    select: { id: true },
  });
  return variant.id;
}

/**
 * Registra uma observação de preço. Se a última observação do mesmo anúncio (e variação) tem os mesmos
 * valores e foi há menos de `dedupeMinutes`, NÃO grava outra: devolve a existente. Em ambos os casos
 * atualiza Product.lastSeenAt. Quando `variantId` não é informado mas o anúncio traz `variationId`,
 * a variação é criada/associada automaticamente.
 */
export async function recordObservation(
  listing: NormalizedListing,
  productId: string,
  variantId?: string | null,
  opts: RecordOptions = {},
): Promise<PriceHistory> {
  const client = opts.client ?? prisma;
  const dedupeMs = (opts.dedupeMinutes ?? DEFAULT_DEDUPE_MINUTES) * MINUTE_MS;
  const resolvedVariantId = variantId ?? (listing.variationId ? await getOrCreateVariantId(productId, listing.variationId, client) : null);
  const original = listing.advertisedOriginalPriceCents ?? null;
  const couponCode = listing.coupon?.code ?? null;
  const couponDiscount = listing.coupon?.discountCents ?? null;

  const last = await client.priceHistory.findFirst({
    where: { productId, listingId: listing.externalId, variantId: resolvedVariantId },
    orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
  });
  const ageMs = last ? listing.observedAt.getTime() - last.observedAt.getTime() : Number.POSITIVE_INFINITY;
  const identical =
    last !== null &&
    last.priceCents === listing.priceCents &&
    last.originalPriceCents === original &&
    last.couponCode === couponCode &&
    last.couponDiscountCents === couponDiscount;

  if (last && identical && ageMs >= 0 && ageMs < dedupeMs) {
    await client.product.update({ where: { id: productId }, data: { lastSeenAt: listing.observedAt } });
    return last;
  }

  const row = await client.priceHistory.create({
    data: {
      productId,
      variantId: resolvedVariantId,
      listingId: listing.externalId,
      source: historySourceLabel(listing.source),
      priceCents: listing.priceCents,
      originalPriceCents: original,
      originalPriceVerified: false, // preço "de" vindo da fonte é só anunciado; a verificação é feita pelo histórico próprio
      availableQuantity: listing.availableQuantity ?? null,
      soldQuantity: listing.soldQuantity ?? null,
      couponCode,
      couponDiscountCents: couponDiscount,
      ...(listing.installments ? { installments: listing.installments as unknown as Prisma.InputJsonValue } : {}),
      observedAt: listing.observedAt,
    },
  });
  await client.product.update({ where: { id: productId }, data: { lastSeenAt: listing.observedAt } });
  return row;
}

export interface LoadHistoryOptions {
  /** undefined: todas as variações; null: só linhas sem variação; string: só aquela variação. */
  variantId?: string | null;
  now?: Date;
  client?: Client;
}

/** Observações do produto nos últimos `sinceDays` dias, da mais antiga para a mais recente. */
export async function loadHistory(
  productId: string,
  sinceDays: number,
  opts: LoadHistoryOptions = {},
): Promise<{ priceCents: number; observedAt: Date }[]> {
  const client = opts.client ?? prisma;
  const since = addDays(opts.now ?? new Date(), -sinceDays);
  return client.priceHistory.findMany({
    where: { productId, observedAt: { gte: since }, ...(opts.variantId !== undefined ? { variantId: opts.variantId } : {}) },
    orderBy: [{ observedAt: 'asc' }, { id: 'asc' }],
    select: { priceCents: true, observedAt: true },
  });
}

/**
 * Poda observações mais antigas que a retenção (settings.retention.priceHistoryDays).
 * Sempre preserva a observação mais recente de cada produto (referência de continuidade).
 */
export async function pruneHistory(opts: { days?: number; now?: Date } = {}): Promise<number> {
  const days = opts.days ?? (await getSettings()).retention.priceHistoryDays;
  const cutoff = addDays(opts.now ?? new Date(), -days).toISOString();
  return prisma.$executeRaw`
    DELETE FROM "PriceHistory" ph
    WHERE ph."observedAt" < ${cutoff}::timestamp
      AND EXISTS (
        SELECT 1 FROM "PriceHistory" n
        WHERE n."productId" = ph."productId"
          AND (n."observedAt" > ph."observedAt" OR (n."observedAt" = ph."observedAt" AND n."id" > ph."id"))
      )`;
}
