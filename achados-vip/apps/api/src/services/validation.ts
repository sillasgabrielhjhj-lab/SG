/**
 * ProductValidationService — valida uma listagem ANTES de virar produto/oferta.
 * Regras: título, permalink https, preço > 0, estoque > 0 (quando informado) e preço anômalo vs histórico.
 * Anomalia: queda > 80% sem histórico que a confirme => SUSPENDE o produto por 24h ("dados inconsistentes").
 * Preferimos perder uma oferta rara a publicar um erro de dados.
 */
import type { NormalizedListing } from '../domain/types.js';
import { calcDiscountPct, formatBRL, type PricePoint } from '../domain/pricing.js';
import { prisma } from '../lib/db.js';
import { addHours } from '../lib/time.js';

export const SUSPEND_HOURS = 24;
/** Queda (%) acima da qual o preço é tratado como suspeito se o histórico não a confirma. */
export const ANOMALOUS_DROP_PCT = 80;
/** Uma observação anterior até este fator acima do preço atual "confirma" que aquele nível já existiu. */
const CORROBORATION_FACTOR = 1.25;
export const INCONSISTENT_PREFIX = 'dados inconsistentes';

export type RejectionCode = 'MISSING_TITLE' | 'INVALID_PERMALINK' | 'INVALID_PRICE' | 'OUT_OF_STOCK' | 'INCONSISTENT_DATA';

export type ValidationResult = { ok: true } | { ok: false; code: RejectionCode; reason: string; suspend: boolean };

const reject = (code: RejectionCode, reason: string, suspend = false): ValidationResult => ({ ok: false, code, reason, suspend });

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname !== '' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Descreve a anomalia de preço (texto em pt-BR) ou null se não houver. `history` em ordem cronológica. */
export function detectPriceAnomaly(listing: Pick<NormalizedListing, 'priceCents' | 'advertisedOriginalPriceCents'>, history: readonly PricePoint[]): string | null {
  const price = listing.priceCents;
  const last = history.length ? [...history].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime())[history.length - 1] : undefined;
  if (last) {
    const dropPct = ((last.priceCents - price) / last.priceCents) * 100;
    if (dropPct > ANOMALOUS_DROP_PCT && !history.some((h) => h.priceCents <= price * CORROBORATION_FACTOR)) {
      return `queda de ${Math.round(dropPct)}% (${formatBRL(last.priceCents)} para ${formatBRL(price)}) sem histórico que a confirme`;
    }
    return null;
  }
  // sem histórico, o único "preço anterior" é o anunciado pela fonte
  const advertised = calcDiscountPct(listing.advertisedOriginalPriceCents, price);
  if (advertised !== null && advertised > ANOMALOUS_DROP_PCT) {
    return `desconto anunciado de ${advertised}% (${formatBRL(listing.advertisedOriginalPriceCents!)} para ${formatBRL(price)}) sem histórico que o confirme`;
  }
  return null;
}

export function validateListing(listing: NormalizedListing, ctx: { history: readonly PricePoint[] }): ValidationResult {
  const title = (listing.title ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (title.length < 3) return reject('MISSING_TITLE', 'título ausente ou curto demais');
  if (typeof listing.permalink !== 'string' || !isHttpsUrl(listing.permalink)) return reject('INVALID_PERMALINK', 'permalink ausente ou fora de https');
  if (!Number.isInteger(listing.priceCents) || listing.priceCents <= 0) return reject('INVALID_PRICE', 'preço ausente ou não positivo');
  if (typeof listing.availableQuantity === 'number' && listing.availableQuantity <= 0) return reject('OUT_OF_STOCK', 'sem estoque');
  const anomaly = detectPriceAnomaly(listing, ctx.history);
  if (anomaly) return reject('INCONSISTENT_DATA', `${INCONSISTENT_PREFIX}: ${anomaly}`, true);
  return { ok: true };
}

/** Suspende o produto por `hours` e suspende suas ofertas ainda não decididas/publicadas. */
export async function suspendProduct(productId: string, reason: string, now: Date, hours = SUSPEND_HOURS): Promise<void> {
  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { status: 'SUSPENDED', suspendedUntil: addHours(now, hours), suspendReason: reason.slice(0, 500) } }),
    prisma.offer.updateMany({
      where: { productId, status: { in: ['DISCOVERED', 'APPROVED'] } },
      data: { status: 'SUSPENDED', decisionNote: `Suspensa: ${reason}`.slice(0, 500) },
    }),
  ]);
}
