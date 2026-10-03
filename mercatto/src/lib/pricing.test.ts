import { describe, it, expect } from "vitest";

import { pixPriceCents, isPromotionActive } from "@/lib/pricing";

describe("pixPriceCents", () => {
  it("aplica o desconto de Pix sobre o preço", () => {
    expect(pixPriceCents(10000)).toBe(9500);
  });

  it("arredonda pro centavo mais próximo", () => {
    expect(pixPriceCents(9999)).toBe(9499);
  });
});

describe("isPromotionActive", () => {
  it("false quando não há preço riscado", () => {
    expect(
      isPromotionActive({ compareAtPriceCents: null, promotionStartsAt: null, promotionEndsAt: null }),
    ).toBe(false);
  });

  it("true quando tem preço riscado sem janela definida (desconto permanente)", () => {
    expect(
      isPromotionActive({ compareAtPriceCents: 10000, promotionStartsAt: null, promotionEndsAt: null }),
    ).toBe(true);
  });

  it("true quando a data atual está dentro da janela", () => {
    const start = new Date(Date.now() - 1000 * 60 * 60);
    const end = new Date(Date.now() + 1000 * 60 * 60);
    expect(
      isPromotionActive({ compareAtPriceCents: 10000, promotionStartsAt: start, promotionEndsAt: end }),
    ).toBe(true);
  });

  it("false quando a promoção ainda não começou", () => {
    const start = new Date(Date.now() + 1000 * 60 * 60);
    expect(
      isPromotionActive({ compareAtPriceCents: 10000, promotionStartsAt: start, promotionEndsAt: null }),
    ).toBe(false);
  });

  it("false quando a promoção já terminou", () => {
    const end = new Date(Date.now() - 1000 * 60 * 60);
    expect(
      isPromotionActive({ compareAtPriceCents: 10000, promotionStartsAt: null, promotionEndsAt: end }),
    ).toBe(false);
  });
});
