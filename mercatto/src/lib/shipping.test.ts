import { describe, it, expect } from "vitest";

import { getShippingOptions } from "@/lib/shipping";

describe("getShippingOptions", () => {
  it("retorna duas opções (padrão e expressa)", () => {
    const options = getShippingOptions("50000-000");
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.id)).toEqual(["standard", "express"]);
  });

  it("entrega expressa é mais rápida e mais cara que a padrão", () => {
    const [standard, express] = getShippingOptions("01310-100");
    expect(express.days).toBeLessThanOrEqual(standard.days);
    expect(express.costCents).toBeGreaterThan(standard.costCents);
  });

  it("é determinístico: o mesmo CEP sempre gera a mesma estimativa", () => {
    const first = getShippingOptions("20000-000");
    const second = getShippingOptions("20000-000");
    expect(first).toEqual(second);
  });

  it("ignora caracteres não numéricos do CEP", () => {
    const withDash = getShippingOptions("50000-000");
    const withoutDash = getShippingOptions("50000000");
    expect(withDash).toEqual(withoutDash);
  });

  it("nunca gera prazo menor que 1 dia", () => {
    for (const cep of ["00000-000", "11111-111", "99999-999"]) {
      const [, express] = getShippingOptions(cep);
      expect(express.days).toBeGreaterThanOrEqual(1);
    }
  });
});
