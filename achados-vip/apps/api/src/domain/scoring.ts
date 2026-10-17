/**
 * Score 0..100 de uma oferta (puro). 9 critérios com pesos de settings.scoring.weights normalizados para somar 100.
 * Regra de honestidade: critério sem dado REAL contribui 0 pontos e a nota começa com "sem dado".
 * Desconto só pontua com referência VERIFICADA; desconto apenas anunciado nunca pontua como verificado.
 */
import { calcDiscountPct, calcSavingsCents, formatBRL, isAdvertisedDiscountPlausible } from './pricing.js';
import { ScoringWeightsSchema, type ScoringWeights, type Settings } from './settings.js';
import type { ScoreInput, ScoreResult } from './types.js';

export const NO_DATA = 'sem dado';

type Criterion = keyof ScoringWeights;
type Tier = ScoreResult['tier'];
type Thresholds = Settings['scoring']['thresholds'];
/** fraction null => sem dado real. */
interface Evaluation {
  fraction: number | null;
  note: string;
}

const CRITERIA = ['discount', 'savings', 'historical', 'seller', 'availability', 'demand', 'category', 'recency', 'listingQuality'] as const satisfies readonly Criterion[];

const HOUR_MS = 3_600_000;
const noData = (why: string): Evaluation => ({ fraction: null, note: `${NO_DATA}: ${why}` });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Interpolação linear por partes (x crescente); fora dos extremos, fixa no extremo. */
function curve(x: number, pts: readonly (readonly [number, number])[]): number {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/** Pesos normalizados para somar 100. Soma <= 0 (tudo zerado) => volta aos pesos padrão. */
export function normalizeWeights(weights: ScoringWeights): Record<Criterion, number> {
  const sum = CRITERIA.reduce((acc, k) => acc + Math.max(0, weights[k]), 0);
  const base = sum > 0 && Number.isFinite(sum) ? weights : ScoringWeightsSchema.parse({});
  const total = CRITERIA.reduce((acc, k) => acc + Math.max(0, base[k]), 0);
  const out = {} as Record<Criterion, number>;
  for (const k of CRITERIA) out[k] = (Math.max(0, base[k]) / total) * 100;
  return out;
}

/** Faixa pelos limiares configuráveis (EXCEPTIONAL >= exceptional, EXCELLENT >= excellent, GOOD >= good). */
export function tierFor(score: number, thresholds: Thresholds): Tier {
  // garante monotonia mesmo com configuração incoerente (ex.: excellent > exceptional)
  const exceptional = thresholds.exceptional;
  const excellent = Math.min(thresholds.excellent, exceptional);
  const good = Math.min(thresholds.good, excellent);
  if (score >= exceptional) return 'EXCEPTIONAL';
  if (score >= excellent) return 'EXCELLENT';
  if (score >= good) return 'GOOD';
  return 'BELOW';
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Desde quando o preço atual existe: se já houve preço maior no histórico, desde a observação seguinte (a queda); senão, desde a 1ª vez visto. */
function priceSince(history: ScoreInput['history'], price: number, firstSeenAt: Date, observedAt: Date): Date {
  const sorted = history.filter((h) => isNum(h.priceCents) && !Number.isNaN(h.observedAt.getTime())).sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  let lastHigher = -1;
  sorted.forEach((h, i) => {
    if (h.priceCents > price) lastHigher = i;
  });
  if (lastHigher === -1) return firstSeenAt;
  return sorted[lastHigher + 1]?.observedAt ?? observedAt;
}

const SELLER_LEVEL: Record<string, number> = { green: 1, light_green: 0.8, yellow: 0.5, orange: 0.25, red: 0 };
const POWER_SELLER: Record<string, number> = { platinum: 1, gold: 0.9, silver: 0.75 };

function evalSeller(seller: ScoreInput['listing']['seller']): Evaluation {
  const parts: { value: number; label: string }[] = [];
  if (seller?.reputationLevel && seller.reputationLevel in SELLER_LEVEL) {
    parts.push({ value: SELLER_LEVEL[seller.reputationLevel]!, label: `reputação ${seller.reputationLevel}` });
  }
  if (isNum(seller?.positiveRatio)) {
    parts.push({ value: curve(seller.positiveRatio, [[0.8, 0], [0.9, 0.5], [0.95, 0.8], [0.99, 1]]), label: `${Math.round(seller.positiveRatio * 100)}% positivas` });
  }
  if (seller?.powerSellerStatus) {
    parts.push({ value: POWER_SELLER[seller.powerSellerStatus.toLowerCase()] ?? 0.5, label: `MercadoLíder ${seller.powerSellerStatus}` });
  }
  if (isNum(seller?.completedTransactions) && seller.completedTransactions >= 0) {
    parts.push({ value: curve(seller.completedTransactions, [[0, 0], [50, 0.3], [500, 0.7], [5000, 1]]), label: `${seller.completedTransactions} vendas concluídas` });
  }
  if (!parts.length) return noData('vendedor sem dados de reputação');
  return { fraction: parts.reduce((a, p) => a + p.value, 0) / parts.length, note: parts.map((p) => p.label).join(', ') };
}

function evalQuality(q: ScoreInput['listing']['quality']): Evaluation {
  const parts: { value: number; label: string }[] = [];
  if (isNum(q?.pictureCount)) parts.push({ value: curve(q.pictureCount, [[0, 0], [1, 0.2], [3, 0.6], [6, 1]]), label: `${q.pictureCount} foto(s)` });
  if (typeof q?.hasWarranty === 'boolean') parts.push({ value: q.hasWarranty ? 1 : 0, label: q.hasWarranty ? 'com garantia' : 'sem garantia' });
  if (typeof q?.freeShipping === 'boolean') parts.push({ value: q.freeShipping ? 1 : 0, label: q.freeShipping ? 'frete grátis' : 'sem frete grátis' });
  if (!parts.length) return noData('anúncio sem dados de qualidade');
  return { fraction: parts.reduce((a, p) => a + p.value, 0) / parts.length, note: parts.map((p) => p.label).join(', ') };
}

export function scoreOffer(input: ScoreInput, settings: Settings): ScoreResult {
  const { listing, now } = input;
  const price = listing.priceCents;
  const weights = normalizeWeights(settings.scoring.weights);
  const minObs = settings.scoring.minHistoryObservations;

  const finish = (evals: Record<Criterion, Evaluation>, disc: Pick<ScoreResult, 'discountPct' | 'savingsCents' | 'discountVerified' | 'advertisedOnly'>): ScoreResult => {
    const breakdown: ScoreResult['breakdown'] = {};
    let total = 0;
    for (const k of CRITERIA) {
      const e = evals[k];
      const points = weights[k] === 0 ? 0 : weights[k] * clamp(e.fraction ?? 0, 0, 1);
      total += points;
      breakdown[k] = { points: round2(points), max: round2(weights[k]), note: weights[k] === 0 ? 'desativado (peso 0)' : e.note };
    }
    const score = clamp(Math.round(total), 0, 100);
    return { score, tier: tierFor(score, settings.scoring.thresholds), breakdown, ...disc };
  };

  if (!isNum(price) || price <= 0) {
    const invalid = Object.fromEntries(CRITERIA.map((k) => [k, { fraction: 0, note: 'preço inválido' }])) as Record<Criterion, Evaluation>;
    return finish(invalid, { discountPct: null, savingsCents: null, discountVerified: false, advertisedOnly: false });
  }

  // --- desconto / economia: SOMENTE com referência verificada ---
  const ref = input.verifiedReferenceCents;
  const refPct = calcDiscountPct(ref, price);
  const discountVerified = refPct !== null && refPct >= 1;
  const discountPct = discountVerified ? refPct : null;
  const savingsCents = discountVerified ? calcSavingsCents(ref, price) : null;
  const advertised = listing.advertisedOriginalPriceCents;
  const advertisedOnly = !discountVerified && calcSavingsCents(advertised, price) !== null;

  let discount: Evaluation;
  let savings: Evaluation;
  if (discountVerified && discountPct !== null && savingsCents !== null && ref != null) {
    discount = { fraction: curve(discountPct, [[0, 0], [10, 0.3], [20, 0.55], [30, 0.75], [40, 0.9], [50, 1]]), note: `${discountPct}% abaixo da referência verificada (${formatBRL(ref)})` };
    savings = { fraction: curve(savingsCents, [[0, 0], [2000, 0.3], [5000, 0.5], [10000, 0.7], [20000, 0.85], [50000, 1]]), note: `economia de ${formatBRL(savingsCents)} vs. referência verificada` };
  } else if (advertisedOnly) {
    const advPct = calcDiscountPct(advertised, price);
    const plausible = isAdvertisedDiscountPlausible(advertised, price, input.history);
    discount = noData(`desconto anunciado de ${advPct}% não verificado, não pontua${plausible ? '' : ' (incoerente com o histórico)'}`);
    savings = noData('economia só anunciada, não verificada');
  } else {
    discount = noData('sem referência de preço verificada');
    savings = noData('sem referência de preço verificada');
  }

  // --- preço vs. histórico próprio (mediana) ---
  const prices = input.history.filter((h) => isNum(h.priceCents) && h.priceCents > 0).map((h) => h.priceCents).sort((a, b) => a - b);
  let historical: Evaluation;
  if (prices.length < minObs) {
    historical = noData(`histórico com ${prices.length} observação(ões), mínimo ${minObs}`);
  } else {
    const med = median(prices);
    const drop = ((med - price) / med) * 100;
    const isLow = price <= prices[0]! && prices[prices.length - 1]! > prices[0]!;
    historical = {
      fraction: curve(drop, [[0, 0], [3, 0.2], [10, 0.5], [20, 0.8], [30, 1]]),
      note: (drop > 0 ? `${Math.round(drop)}% abaixo da mediana do histórico` : 'igual ou acima da mediana do histórico') + ` (${prices.length} obs.)` + (isLow ? '; menor preço observado' : ''),
    };
  }

  // --- disponibilidade e procura (dados reais da fonte) ---
  const qty = listing.availableQuantity;
  const availability: Evaluation = !isNum(qty)
    ? noData('estoque não informado pela fonte')
    : { fraction: curve(qty, [[0, 0], [1, 0.2], [5, 0.5], [20, 0.8], [50, 1]]), note: qty <= 0 ? 'sem estoque' : `${qty} disponível(is)` };
  const sold = listing.soldQuantity;
  const demand: Evaluation = !isNum(sold)
    ? noData('vendidos não informado pela fonte')
    : { fraction: curve(sold, [[0, 0], [10, 0.2], [50, 0.45], [200, 0.7], [1000, 0.9], [5000, 1]]), note: `${sold} vendido(s)` };

  // --- relevância da categoria (configurada no painel, 0..100) ---
  const rel = input.categoryRelevance;
  const category: Evaluation = !isNum(rel) ? noData('categoria sem relevância configurada') : { fraction: clamp(rel, 0, 100) / 100, note: `relevância ${Math.round(clamp(rel, 0, 100))}/100` };

  // --- recência: há quanto tempo o preço atual está no ar (queda recente) ou o produto foi descoberto ---
  let recency: Evaluation;
  if (Number.isNaN(input.firstSeenAt.getTime()) || Number.isNaN(listing.observedAt.getTime())) {
    recency = noData('datas de observação inválidas');
  } else {
    const since = priceSince(input.history, price, input.firstSeenAt, listing.observedAt);
    const ageH = Math.max(0, now.getTime() - since.getTime()) / HOUR_MS;
    recency = { fraction: curve(ageH, [[0, 1], [6, 0.9], [24, 0.7], [72, 0.4], [168, 0.1], [336, 0]]), note: `preço atual há ${ageH < 1 ? '<1' : Math.round(ageH)}h` };
  }

  return finish(
    { discount, savings, historical, seller: evalSeller(listing.seller), availability, demand, category, recency, listingQuality: evalQuality(listing.quality) },
    { discountPct, savingsCents, discountVerified, advertisedOnly },
  );
}
