/** Cálculos de preço (puros). Dinheiro sempre em centavos; datas recebidas por parâmetro (sem Date.now()). */

export interface PricePoint {
  priceCents: number;
  observedAt: Date;
}

const DAY_MS = 86_400_000;

/** Descontos anunciados acima disso (%) são tratados como implausíveis. */
export const MAX_PLAUSIBLE_ADVERTISED_DISCOUNT_PCT = 90;
/** O "preço original" anunciado pode exceder o maior preço do histórico em até 20% e ainda ser plausível. */
export const ADVERTISED_HISTORY_TOLERANCE = 1.2;

const isPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Desconto inteiro (Math.round) de `original` para `price`.
 * null se algum valor for inválido (<=0, NaN, null) ou se original <= price.
 * Atenção: pode retornar 0 quando a diferença é menor que 0,5% (não é desconto exibível).
 */
export function calcDiscountPct(originalCents: number | null | undefined, priceCents: number | null | undefined): number | null {
  if (!isPrice(originalCents) || !isPrice(priceCents) || originalCents <= priceCents) return null;
  return Math.round(((originalCents - priceCents) / originalCents) * 100);
}

/** Economia em centavos (original - price); null se inválido ou original <= price. */
export function calcSavingsCents(originalCents: number | null | undefined, priceCents: number | null | undefined): number | null {
  if (!isPrice(originalCents) || !isPrice(priceCents) || originalCents <= priceCents) return null;
  return Math.round(originalCents - priceCents);
}

/** "R$ 1.299,90". Independe de ICU/locale do Node (sem espaço não separável). Negativos: "-R$ 1,00". */
export function formatBRL(cents: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) throw new RangeError('formatBRL: valor inválido');
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = String(abs % 100).padStart(2, '0');
  return `${rounded < 0 ? '-' : ''}R$ ${reais},${centavos}`;
}

/**
 * Referência VERIFICADA: maior preço observado no histórico próprio dentro da janela
 * [now - windowDays, now] que seja > priceCents. Exige ao menos `minObservations` observações válidas
 * na janela (padrão 3, igual a settings.scoring.minHistoryObservations). Caso contrário, null.
 * Observações futuras (relógio incoerente) ou com preço inválido são ignoradas.
 */
export function verifiedReference(
  history: readonly PricePoint[],
  priceCents: number,
  now: Date,
  opts: { windowDays?: number; minObservations?: number } = {},
): number | null {
  const windowDays = opts.windowDays ?? 90;
  const minObservations = Math.max(1, opts.minObservations ?? 3);
  if (!isPrice(priceCents)) return null;
  const to = now.getTime();
  const from = to - windowDays * DAY_MS;
  let count = 0;
  let max = 0;
  for (const p of history) {
    const t = p.observedAt.getTime();
    if (!Number.isFinite(t) || t < from || t > to || !isPrice(p.priceCents)) continue;
    count++;
    if (p.priceCents > max) max = p.priceCents;
  }
  if (count < minObservations) return null;
  return max > priceCents ? max : null;
}

/**
 * O "preço original" ANUNCIADO é plausível? Só serve para anotar/alertar — NÃO verifica desconto.
 * Falso se: inválido, <= preço, desconto > 90%, ou (havendo histórico) muito acima do maior preço já observado.
 * Sem histórico não dá para refutar ⇒ true (continua não verificado).
 */
export function isAdvertisedDiscountPlausible(
  advertisedOriginalCents: number | null | undefined,
  priceCents: number,
  history: readonly { priceCents: number }[] = [],
): boolean {
  const pct = calcDiscountPct(advertisedOriginalCents, priceCents);
  if (pct === null || !isPrice(advertisedOriginalCents)) return false;
  if (pct > MAX_PLAUSIBLE_ADVERTISED_DISCOUNT_PCT) return false;
  let max = 0;
  for (const h of history) if (isPrice(h.priceCents) && h.priceCents > max) max = h.priceCents;
  if (max === 0) return true;
  return advertisedOriginalCents <= Math.max(max, priceCents) * ADVERTISED_HISTORY_TOLERANCE;
}
