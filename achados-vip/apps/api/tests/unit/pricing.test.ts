import { describe, expect, it } from 'vitest';
import { calcDiscountPct, calcSavingsCents, formatBRL, isAdvertisedDiscountPlausible, verifiedReference, type PricePoint } from '../../src/domain/pricing.js';

const NOW = new Date('2026-10-17T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const pts = (...rows: [number, number][]): PricePoint[] => rows.map(([price, d]) => ({ priceCents: price, observedAt: daysAgo(d) }));

describe('calcDiscountPct', () => {
  it('calcula o desconto inteiro', () => {
    expect(calcDiscountPct(10000, 7500)).toBe(25);
    expect(calcDiscountPct(199990, 149990)).toBe(25);
    expect(calcDiscountPct(10000, 5000)).toBe(50);
  });
  it('arredonda com Math.round (não para baixo)', () => {
    expect(calcDiscountPct(1000, 666)).toBe(33); // 33,4
    expect(calcDiscountPct(1000, 664)).toBe(34); // 33,6
    expect(calcDiscountPct(1000, 999)).toBe(0); // 0,1% => 0 (não é desconto exibível)
  });
  it('retorna null quando original <= preço', () => {
    expect(calcDiscountPct(1000, 1000)).toBeNull();
    expect(calcDiscountPct(900, 1000)).toBeNull();
  });
  it('retorna null para zero, negativos e valores inválidos', () => {
    expect(calcDiscountPct(0, 0)).toBeNull();
    expect(calcDiscountPct(1000, 0)).toBeNull();
    expect(calcDiscountPct(0, 500)).toBeNull();
    expect(calcDiscountPct(-1000, -2000)).toBeNull();
    expect(calcDiscountPct(1000, -500)).toBeNull();
    expect(calcDiscountPct(Number.NaN, 500)).toBeNull();
    expect(calcDiscountPct(Number.POSITIVE_INFINITY, 500)).toBeNull();
    expect(calcDiscountPct(null, 500)).toBeNull();
    expect(calcDiscountPct(1000, undefined)).toBeNull();
  });
});

describe('calcSavingsCents', () => {
  it('diferença em centavos', () => {
    expect(calcSavingsCents(199990, 149990)).toBe(50000);
  });
  it('null quando não há economia ou dado inválido', () => {
    expect(calcSavingsCents(1000, 1000)).toBeNull();
    expect(calcSavingsCents(900, 1000)).toBeNull();
    expect(calcSavingsCents(null, 1000)).toBeNull();
    expect(calcSavingsCents(1000, -1)).toBeNull();
  });
});

describe('formatBRL', () => {
  it('formata em reais com milhar e vírgula', () => {
    expect(formatBRL(129990)).toBe('R$ 1.299,90');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(100)).toBe('R$ 1,00');
    expect(formatBRL(99999)).toBe('R$ 999,99');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });
  it('negativos e arredondamento de fração de centavo', () => {
    expect(formatBRL(-100)).toBe('-R$ 1,00');
    expect(formatBRL(99.6)).toBe('R$ 1,00');
  });
  it('usa espaço comum (sem NBSP) para ser estável entre ambientes', () => {
    expect(formatBRL(1000)).not.toContain(' ');
  });
  it('rejeita valores não finitos', () => {
    expect(() => formatBRL(Number.NaN)).toThrow(RangeError);
    expect(() => formatBRL(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('verifiedReference', () => {
  it('devolve o maior preço da janela acima do preço atual', () => {
    const h = pts([20000, 10], [25000, 30], [22000, 60], [21000, 5]);
    expect(verifiedReference(h, 15000, NOW, { minObservations: 3 })).toBe(25000);
  });
  it('ignora observações fora da janela (padrão 90 dias)', () => {
    const h = pts([90000, 120], [20000, 10], [21000, 20], [22000, 30]);
    expect(verifiedReference(h, 15000, NOW, { minObservations: 3 })).toBe(22000);
    expect(verifiedReference(h, 15000, NOW, { minObservations: 3, windowDays: 200 })).toBe(90000);
  });
  it('exige o mínimo de observações DENTRO da janela', () => {
    const h = pts([30000, 10], [28000, 20]);
    expect(verifiedReference(h, 15000, NOW, { minObservations: 3 })).toBeNull();
    expect(verifiedReference(h, 15000, NOW, { minObservations: 2 })).toBe(30000);
    const old = pts([30000, 100], [30000, 110], [30000, 120]);
    expect(verifiedReference(old, 15000, NOW, { minObservations: 3 })).toBeNull();
  });
  it('minObservations padrão = 3 e nunca menos que 1', () => {
    expect(verifiedReference(pts([30000, 1], [30000, 2]), 15000, NOW)).toBeNull();
    expect(verifiedReference(pts([30000, 1], [30000, 2], [30000, 3]), 15000, NOW)).toBe(30000);
    expect(verifiedReference([], 15000, NOW, { minObservations: 0 })).toBeNull();
  });
  it('null se o maior preço observado não supera o atual', () => {
    expect(verifiedReference(pts([10000, 1], [10000, 2], [9000, 3]), 10000, NOW, { minObservations: 3 })).toBeNull();
    expect(verifiedReference(pts([10000, 1], [10000, 2], [9000, 3]), 12000, NOW, { minObservations: 3 })).toBeNull();
  });
  it('ignora observações futuras e preços inválidos', () => {
    const h: PricePoint[] = [...pts([20000, 1], [20000, 2]), { priceCents: 99999, observedAt: new Date(NOW.getTime() + 86_400_000) }, { priceCents: -5, observedAt: daysAgo(3) }, { priceCents: Number.NaN, observedAt: daysAgo(4) }];
    expect(verifiedReference(h, 15000, NOW, { minObservations: 3 })).toBeNull();
    expect(verifiedReference(h, 15000, NOW, { minObservations: 2 })).toBe(20000);
  });
  it('ignora datas inválidas e preço atual inválido', () => {
    expect(verifiedReference([{ priceCents: 30000, observedAt: new Date('x') }], 15000, NOW, { minObservations: 1 })).toBeNull();
    expect(verifiedReference(pts([30000, 1]), 0, NOW, { minObservations: 1 })).toBeNull();
  });
  it('inclui o limite exato da janela', () => {
    expect(verifiedReference(pts([30000, 90]), 15000, NOW, { minObservations: 1 })).toBe(30000);
  });
});

describe('isAdvertisedDiscountPlausible', () => {
  it('false para original inválido ou <= preço', () => {
    expect(isAdvertisedDiscountPlausible(null, 1000)).toBe(false);
    expect(isAdvertisedDiscountPlausible(1000, 1000)).toBe(false);
    expect(isAdvertisedDiscountPlausible(500, 1000)).toBe(false);
  });
  it('false para desconto absurdo (>90%)', () => {
    expect(isAdvertisedDiscountPlausible(100000, 5000)).toBe(false);
  });
  it('sem histórico não refuta (true), mas não verifica', () => {
    expect(isAdvertisedDiscountPlausible(20000, 15000)).toBe(true);
  });
  it('compara com o maior preço do histórico (tolerância de 20%)', () => {
    const hist = [{ priceCents: 20000 }, { priceCents: 18000 }];
    expect(isAdvertisedDiscountPlausible(22000, 15000, hist)).toBe(true);
    expect(isAdvertisedDiscountPlausible(24000, 15000, hist)).toBe(true); // exatamente 1,2x
    expect(isAdvertisedDiscountPlausible(40000, 15000, hist)).toBe(false); // "de" inflado
  });
  it('ignora preços inválidos do histórico', () => {
    expect(isAdvertisedDiscountPlausible(20000, 15000, [{ priceCents: -1 }, { priceCents: Number.NaN }])).toBe(true);
  });
});
