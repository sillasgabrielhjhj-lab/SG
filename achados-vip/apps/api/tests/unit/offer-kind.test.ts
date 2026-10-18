import { describe, expect, it } from 'vitest';
import { POPULAR_MIN_SOLD, chooseKind, hasCoupon, type KindInput } from '../../src/domain/offer-kind.js';

const base: KindInput = { score: 70, tier: 'GOOD' };

describe('chooseKind', () => {
  it('comum por padrão', () => {
    expect(chooseKind(base)).toBe('COMMON');
  });
  it('cupom real => COUPON (código, objeto ou valor)', () => {
    expect(chooseKind({ ...base, couponCode: 'ACHADOS10' })).toBe('COUPON');
    expect(chooseKind({ ...base, coupon: { code: 'X1' } })).toBe('COUPON');
    expect(chooseKind({ ...base, coupon: { discountCents: 1500 } })).toBe('COUPON');
  });
  it('cupom vazio/zerado não conta', () => {
    expect(chooseKind({ ...base, couponCode: '  ', coupon: { code: '', discountCents: 0 } })).toBe('COMMON');
    expect(chooseKind({ ...base, coupon: null })).toBe('COMMON');
    expect(hasCoupon({ coupon: { code: null, discountCents: null } })).toBe(false);
  });
  it('relâmpago só com flag explícita', () => {
    expect(chooseKind({ ...base, flashDeal: true })).toBe('FLASH');
    expect(chooseKind({ ...base, flashDeal: false })).toBe('COMMON');
  });
  it('maior desconto do dia', () => {
    expect(chooseKind({ ...base, isTopDiscountOfDay: true })).toBe('TOP_DISCOUNT_OF_DAY');
  });
  it('tier EXCEPTIONAL => EXCEPTIONAL_PRICE', () => {
    expect(chooseKind({ score: 95, tier: 'EXCEPTIONAL' })).toBe('EXCEPTIONAL_PRICE');
    expect(chooseKind({ score: 80, tier: 'EXCELLENT' })).toBe('COMMON');
  });
  it('popular só com vendidos reais >= limite', () => {
    expect(chooseKind({ ...base, soldQuantity: POPULAR_MIN_SOLD })).toBe('POPULAR');
    expect(chooseKind({ ...base, soldQuantity: POPULAR_MIN_SOLD - 1 })).toBe('COMMON');
    expect(chooseKind({ ...base, soldQuantity: null })).toBe('COMMON');
    expect(chooseKind({ ...base, soldQuantity: Number.NaN })).toBe('COMMON');
    expect(chooseKind({ ...base, soldQuantity: 100, popularMinSold: 50 })).toBe('POPULAR');
  });
  it('prioridade: cupom > relâmpago > maior desconto > excepcional > popular', () => {
    const all: KindInput = { score: 99, tier: 'EXCEPTIONAL', couponCode: 'C', flashDeal: true, isTopDiscountOfDay: true, soldQuantity: 9999 };
    expect(chooseKind(all)).toBe('COUPON');
    expect(chooseKind({ ...all, couponCode: null })).toBe('FLASH');
    expect(chooseKind({ ...all, couponCode: null, flashDeal: false })).toBe('TOP_DISCOUNT_OF_DAY');
    expect(chooseKind({ ...all, couponCode: null, flashDeal: false, isTopDiscountOfDay: false })).toBe('EXCEPTIONAL_PRICE');
    expect(chooseKind({ ...all, couponCode: null, flashDeal: false, isTopDiscountOfDay: false, tier: 'EXCELLENT' })).toBe('POPULAR');
  });
});
