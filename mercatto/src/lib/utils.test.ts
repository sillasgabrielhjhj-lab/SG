import { describe, it, expect } from "vitest";

import { formatCurrencyBRL, formatInstallments } from "@/lib/utils";

describe("formatCurrencyBRL", () => {
  it("formata centavos como reais no padrão brasileiro", () => {
    expect(formatCurrencyBRL(1000)).toBe("R$ 10,00");
    expect(formatCurrencyBRL(199990)).toBe("R$ 1.999,90");
  });

  it("formata zero corretamente", () => {
    expect(formatCurrencyBRL(0)).toBe("R$ 0,00");
  });
});

describe("formatInstallments", () => {
  it("divide o valor pelo número de parcelas", () => {
    expect(formatInstallments(120000, 12)).toContain("12x de R$ 100,00");
  });

  it("usa 12 parcelas por padrão", () => {
    expect(formatInstallments(120000)).toContain("12x");
  });
});
