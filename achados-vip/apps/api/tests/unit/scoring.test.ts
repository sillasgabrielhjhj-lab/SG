import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../src/domain/settings.js';
import { normalizeWeights, scoreOffer, tierFor } from '../../src/domain/scoring.js';
import type { NormalizedListing, ScoreInput } from '../../src/domain/types.js';

const NOW = new Date('2026-10-17T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

const listing = (over: Partial<NormalizedListing> = {}): NormalizedListing => ({
  source: 'fixture',
  externalId: 'MLB1',
  title: 'Produto de teste',
  permalink: 'https://produto.mercadolivre.com.br/MLB-1-teste',
  priceCents: 15000,
  observedAt: NOW,
  ...over,
});
const input = (over: Partial<ScoreInput> = {}, l: Partial<NormalizedListing> = {}): ScoreInput => ({
  listing: listing(l),
  verifiedReferenceCents: null,
  history: [],
  categoryRelevance: 50,
  firstSeenAt: NOW,
  now: NOW,
  ...over,
});
const withWeights = (w: Partial<Settings['scoring']['weights']>): Settings => {
  const s = defaultSettings();
  s.scoring.weights = { discount: 0, savings: 0, historical: 0, seller: 0, availability: 0, demand: 0, category: 0, recency: 0, listingQuality: 0, ...w };
  return s;
};
const settings = defaultSettings();

/** Oferta "completa": todos os dados reais presentes, desconto de 40% verificado. */
const fullInput = (): ScoreInput =>
  input(
    {
      verifiedReferenceCents: 25000,
      history: [25000, 24000, 25000, 23000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(10 + i) })),
      categoryRelevance: 100,
      firstSeenAt: daysAgo(20),
    },
    {
      priceCents: 15000,
      availableQuantity: 100,
      soldQuantity: 5000,
      seller: { id: 's', reputationLevel: 'green', positiveRatio: 0.99, powerSellerStatus: 'platinum', completedTransactions: 10000 },
      quality: { pictureCount: 8, hasWarranty: true, freeShipping: true },
    },
  );

describe('normalizeWeights', () => {
  it('normaliza para somar 100 mantendo proporções', () => {
    const w = normalizeWeights({ ...defaultSettings().scoring.weights, discount: 50, savings: 50, historical: 0, seller: 0, availability: 0, demand: 0, category: 0, recency: 0, listingQuality: 0 });
    expect(w.discount).toBeCloseTo(50);
    expect(w.savings).toBeCloseTo(50);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
  it('pesos padrão já somam 100 e ficam intactos', () => {
    const w = normalizeWeights(defaultSettings().scoring.weights);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(w.discount).toBeCloseTo(25);
  });
  it('soma diferente de 100 (ex.: 200) é reescalada', () => {
    const w = normalizeWeights({ ...defaultSettings().scoring.weights, discount: 125 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(w.discount).toBeCloseTo((125 / 200) * 100);
  });
  it('tudo zerado volta aos pesos padrão (nunca divide por zero)', () => {
    const w = normalizeWeights(withWeights({}).scoring.weights);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(Number.isFinite(w.discount)).toBe(true);
  });
});

describe('tierFor', () => {
  const t = { exceptional: 90, excellent: 75, good: 60 };
  it('limites 90/75/60 (inclusivos)', () => {
    expect(tierFor(100, t)).toBe('EXCEPTIONAL');
    expect(tierFor(90, t)).toBe('EXCEPTIONAL');
    expect(tierFor(89, t)).toBe('EXCELLENT');
    expect(tierFor(75, t)).toBe('EXCELLENT');
    expect(tierFor(74, t)).toBe('GOOD');
    expect(tierFor(60, t)).toBe('GOOD');
    expect(tierFor(59, t)).toBe('BELOW');
    expect(tierFor(0, t)).toBe('BELOW');
  });
  it('limiares customizados', () => {
    const c = { exceptional: 95, excellent: 80, good: 50 };
    expect(tierFor(94, c)).toBe('EXCELLENT');
    expect(tierFor(95, c)).toBe('EXCEPTIONAL');
    expect(tierFor(79, c)).toBe('GOOD');
    expect(tierFor(49, c)).toBe('BELOW');
  });
  it('configuração incoerente continua monótona', () => {
    const bad = { exceptional: 70, excellent: 80, good: 90 };
    expect(tierFor(70, bad)).toBe('EXCEPTIONAL');
    expect(tierFor(69, bad)).toBe('BELOW');
  });
});

describe('scoreOffer: oferta completa com desconto verificado', () => {
  const r = scoreOffer(fullInput(), settings);
  it('pontua alto, inteiro 0..100 e faixa coerente', () => {
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.tier).toBe('EXCEPTIONAL');
  });
  it('expõe desconto verificado', () => {
    expect(r).toMatchObject({ discountVerified: true, discountPct: 40, savingsCents: 10000, advertisedOnly: false });
  });
  it('9 critérios no breakdown, max somando ~100, pontos <= max', () => {
    const entries = Object.entries(r.breakdown);
    expect(entries.map(([k]) => k).sort()).toEqual(['availability', 'category', 'demand', 'discount', 'historical', 'listingQuality', 'recency', 'savings', 'seller']);
    expect(entries.reduce((a, [, v]) => a + v.max, 0)).toBeGreaterThan(99.9);
    expect(entries.reduce((a, [, v]) => a + v.max, 0)).toBeLessThan(100.1);
    for (const [, v] of entries) expect(v.points).toBeLessThanOrEqual(v.max);
    expect(r.breakdown.discount!.note).toContain('referência verificada');
  });
});

describe('scoreOffer: desconto apenas anunciado', () => {
  const base = input({}, { priceCents: 15000, advertisedOriginalPriceCents: 30000, availableQuantity: 10 });
  const r = scoreOffer(base, settings);
  it('marca advertisedOnly e não verifica nem expõe desconto', () => {
    expect(r.advertisedOnly).toBe(true);
    expect(r.discountVerified).toBe(false);
    expect(r.discountPct).toBeNull();
    expect(r.savingsCents).toBeNull();
  });
  it('desconto e economia valem 0 com nota "sem dado"', () => {
    expect(r.breakdown.discount!.points).toBe(0);
    expect(r.breakdown.discount!.note.startsWith('sem dado')).toBe(true);
    expect(r.breakdown.discount!.note).toContain('anunciado');
    expect(r.breakdown.savings!.points).toBe(0);
    expect(r.breakdown.savings!.note.startsWith('sem dado')).toBe(true);
  });
  it('o score é idêntico ao da mesma oferta sem preço anunciado', () => {
    const semAnuncio = scoreOffer(input({}, { priceCents: 15000, availableQuantity: 10 }), settings);
    expect(r.score).toBe(semAnuncio.score);
  });
  it('avisa quando o "de" anunciado é incoerente com o histórico', () => {
    const hist = [20000, 20000, 19000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(i + 1) }));
    const r2 = scoreOffer(input({ history: hist }, { priceCents: 15000, advertisedOriginalPriceCents: 60000 }), settings);
    expect(r2.advertisedOnly).toBe(true);
    expect(r2.breakdown.discount!.note).toContain('incoerente com o histórico');
  });
  it('referência verificada vence o anúncio (advertisedOnly = false)', () => {
    const r3 = scoreOffer(input({ verifiedReferenceCents: 20000 }, { priceCents: 15000, advertisedOriginalPriceCents: 30000 }), settings);
    expect(r3.advertisedOnly).toBe(false);
    expect(r3.discountVerified).toBe(true);
    expect(r3.discountPct).toBe(25); // 25%, não os 50% anunciados
  });
});

describe('scoreOffer: sem dados reais', () => {
  const r = scoreOffer(input({ categoryRelevance: 40 }), settings);
  it('critérios sem dado valem 0 e registram "sem dado"', () => {
    for (const k of ['discount', 'savings', 'historical', 'seller', 'availability', 'demand', 'listingQuality']) {
      expect(r.breakdown[k]!.points).toBe(0);
      expect(r.breakdown[k]!.note.startsWith('sem dado')).toBe(true);
    }
  });
  it('só categoria e recência pontuam (dados que o sistema possui)', () => {
    expect(r.breakdown.category!.points).toBeGreaterThan(0);
    expect(r.breakdown.recency!.points).toBeGreaterThan(0);
    expect(r.discountVerified).toBe(false);
    expect(r.advertisedOnly).toBe(false);
    expect(r.tier).toBe('BELOW');
  });
  it('categoryRelevance inválido => sem dado', () => {
    const r2 = scoreOffer(input({ categoryRelevance: Number.NaN }), settings);
    expect(r2.breakdown.category!.note.startsWith('sem dado')).toBe(true);
  });
});

describe('scoreOffer: referência verificada inválida', () => {
  it('referência <= preço não vira desconto', () => {
    const r = scoreOffer(input({ verifiedReferenceCents: 15000 }), settings);
    expect(r.discountVerified).toBe(false);
    expect(r.discountPct).toBeNull();
    const r2 = scoreOffer(input({ verifiedReferenceCents: 10000 }), settings);
    expect(r2.discountVerified).toBe(false);
  });
  it('diferença < 1% não é tratada como desconto', () => {
    const r = scoreOffer(input({ verifiedReferenceCents: 15010 }), settings);
    expect(r.discountVerified).toBe(false);
    expect(r.savingsCents).toBeNull();
  });
  it('preço inválido => score 0 sem exceção', () => {
    const r = scoreOffer(input({}, { priceCents: 0 }), settings);
    expect(r.score).toBe(0);
    expect(r.tier).toBe('BELOW');
    const r2 = scoreOffer(input({}, { priceCents: Number.NaN }), settings);
    expect(r2.score).toBe(0);
  });
});

describe('scoreOffer: pesos configuráveis', () => {
  it('só desconto com peso: 40% de desconto vale 90% do máximo', () => {
    const r = scoreOffer(input({ verifiedReferenceCents: 25000 }), withWeights({ discount: 7 }));
    expect(r.breakdown.discount!.max).toBe(100);
    expect(r.score).toBe(90);
  });
  it('mesmos dados, pesos diferentes, scores diferentes', () => {
    const i = input({ verifiedReferenceCents: 25000, categoryRelevance: 0 });
    const a = scoreOffer(i, withWeights({ discount: 10, category: 0 })).score;
    const b = scoreOffer(i, withWeights({ discount: 10, category: 10 })).score;
    expect(a).toBe(90);
    expect(b).toBe(45);
  });
  it('peso 0 desativa o critério', () => {
    const r = scoreOffer(fullInput(), withWeights({ discount: 1 }));
    expect(r.breakdown.savings!.note).toBe('desativado (peso 0)');
    expect(r.breakdown.savings!.max).toBe(0);
  });
  it('desconto 50%+ com todo o peso no desconto chega a 100 (clamp)', () => {
    const r = scoreOffer(input({ verifiedReferenceCents: 60000 }), withWeights({ discount: 3 }));
    expect(r.score).toBe(100);
    expect(r.tier).toBe('EXCEPTIONAL');
  });
  it('limiares de settings alteram a faixa', () => {
    const s = defaultSettings();
    s.scoring.thresholds = { exceptional: 99, excellent: 98, good: 97 };
    expect(scoreOffer(fullInput(), s).tier).not.toBe('EXCEPTIONAL');
  });
});

describe('scoreOffer: critérios individuais', () => {
  const only = (k: keyof Settings['scoring']['weights']) => withWeights({ [k]: 1 });

  it('histórico: abaixo do mínimo de observações => sem dado', () => {
    const hist = [20000, 21000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(i + 1) }));
    const r = scoreOffer(input({ history: hist }), only('historical'));
    expect(r.breakdown.historical!.note.startsWith('sem dado')).toBe(true);
    expect(r.score).toBe(0);
  });
  it('histórico: preço bem abaixo da mediana pontua; "menor preço observado" na nota', () => {
    const hist = [20000, 21000, 22000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(i + 1) }));
    const r = scoreOffer(input({ history: hist }, { priceCents: 14000 }), only('historical'));
    expect(r.score).toBeGreaterThan(80);
    expect(r.breakdown.historical!.note).toContain('menor preço observado');
  });
  it('histórico: preço estável (igual ao histórico) não pontua', () => {
    const hist = [15000, 15000, 15000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(i + 1) }));
    const r = scoreOffer(input({ history: hist }), only('historical'));
    expect(r.score).toBe(0);
    expect(r.breakdown.historical!.note).toContain('igual ou acima');
  });
  it('histórico: respeita minHistoryObservations de settings', () => {
    const s = only('historical');
    s.scoring.minHistoryObservations = 2;
    const hist = [20000, 21000].map((p, i) => ({ priceCents: p, observedAt: daysAgo(i + 1) }));
    expect(scoreOffer(input({ history: hist }, { priceCents: 14000 }), s).score).toBeGreaterThan(0);
  });
  it('vendedor: reputação verde > amarela > vermelha; sem dados => sem dado', () => {
    const f = (level: 'green' | 'yellow' | 'red') => scoreOffer(input({}, { seller: { id: 's', reputationLevel: level } }), only('seller')).score;
    expect(f('green')).toBe(100);
    expect(f('yellow')).toBe(50);
    expect(f('red')).toBe(0);
    const none = scoreOffer(input({}, { seller: { id: 's', reputationLevel: null, positiveRatio: null } }), only('seller'));
    expect(none.breakdown.seller!.note.startsWith('sem dado')).toBe(true);
    expect(scoreOffer(input({}, { seller: null }), only('seller')).breakdown.seller!.note.startsWith('sem dado')).toBe(true);
  });
  it('vendedor: combina sinais disponíveis (média)', () => {
    const r = scoreOffer(input({}, { seller: { id: 's', reputationLevel: 'green', positiveRatio: 0.8 } }), only('seller'));
    expect(r.score).toBe(50); // (1 + 0) / 2
    const p = scoreOffer(input({}, { seller: { id: 's', powerSellerStatus: 'platinum', completedTransactions: 5000 } }), only('seller'));
    expect(p.score).toBe(100);
    const unknownPower = scoreOffer(input({}, { seller: { id: 's', powerSellerStatus: 'bronze' } }), only('seller'));
    expect(unknownPower.score).toBe(50);
  });
  it('estoque: 0 => 0 pontos ("sem estoque"); ausente => sem dado; muito => máximo', () => {
    const z = scoreOffer(input({}, { availableQuantity: 0 }), only('availability'));
    expect(z.score).toBe(0);
    expect(z.breakdown.availability!.note).toBe('sem estoque');
    expect(scoreOffer(input({}, { availableQuantity: null }), only('availability')).breakdown.availability!.note.startsWith('sem dado')).toBe(true);
    expect(scoreOffer(input({}, { availableQuantity: 500 }), only('availability')).score).toBe(100);
  });
  it('procura: usa soldQuantity real; ausente => sem dado; 0 vendidos => 0', () => {
    expect(scoreOffer(input({}, { soldQuantity: 5000 }), only('demand')).score).toBe(100);
    expect(scoreOffer(input({}, { soldQuantity: 0 }), only('demand')).score).toBe(0);
    expect(scoreOffer(input({}, { soldQuantity: 0 }), only('demand')).breakdown.demand!.note).not.toMatch(/^sem dado/);
    expect(scoreOffer(input({}, {}), only('demand')).breakdown.demand!.note.startsWith('sem dado')).toBe(true);
  });
  it('categoria: relevância 0..100 com clamp', () => {
    expect(scoreOffer(input({ categoryRelevance: 80 }), only('category')).score).toBe(80);
    expect(scoreOffer(input({ categoryRelevance: 250 }), only('category')).score).toBe(100);
    expect(scoreOffer(input({ categoryRelevance: -5 }), only('category')).score).toBe(0);
  });
  it('recência: oferta recém vista vale mais que antiga', () => {
    const fresh = scoreOffer(input({ firstSeenAt: hoursAgo(1) }), only('recency')).score;
    const day = scoreOffer(input({ firstSeenAt: hoursAgo(24) }), only('recency')).score;
    const old = scoreOffer(input({ firstSeenAt: daysAgo(30) }), only('recency')).score;
    expect(fresh).toBeGreaterThan(day);
    expect(day).toBeGreaterThan(old);
    expect(old).toBe(0);
  });
  it('recência: queda recente de preço conta como recente mesmo em produto antigo', () => {
    const hist = [
      { priceCents: 20000, observedAt: daysAgo(30) },
      { priceCents: 20000, observedAt: daysAgo(10) },
    ];
    const r = scoreOffer(input({ firstSeenAt: daysAgo(30), history: hist }, { observedAt: hoursAgo(1) }), only('recency'));
    expect(r.score).toBeGreaterThanOrEqual(90);
    // com a queda registrada 2 dias atrás
    const hist2 = [...hist, { priceCents: 15000, observedAt: daysAgo(2) }];
    const r2 = scoreOffer(input({ firstSeenAt: daysAgo(30), history: hist2 }), only('recency'));
    expect(r2.score).toBeLessThan(r.score);
    expect(r2.score).toBeGreaterThan(0);
  });
  it('recência: datas inválidas => sem dado', () => {
    const r = scoreOffer(input({ firstSeenAt: new Date('x') }), only('recency'));
    expect(r.breakdown.recency!.note.startsWith('sem dado')).toBe(true);
  });
  it('qualidade do anúncio: usa só campos presentes; vazio => sem dado', () => {
    const good = scoreOffer(input({}, { quality: { pictureCount: 8, hasWarranty: true, freeShipping: true } }), only('listingQuality'));
    expect(good.score).toBe(100);
    const mixed = scoreOffer(input({}, { quality: { freeShipping: true, hasWarranty: false } }), only('listingQuality'));
    expect(mixed.score).toBe(50);
    expect(scoreOffer(input({}, { quality: {} }), only('listingQuality')).breakdown.listingQuality!.note.startsWith('sem dado')).toBe(true);
    expect(scoreOffer(input({}, { quality: null }), only('listingQuality')).breakdown.listingQuality!.note.startsWith('sem dado')).toBe(true);
  });
});
