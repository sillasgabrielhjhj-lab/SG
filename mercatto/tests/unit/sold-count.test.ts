import { describe, expect, it } from "vitest";
import { formatSoldCount } from "@/lib/format";

describe("formatSoldCount", () => {
  it("oculta quando não há vendas", () => {
    expect(formatSoldCount(0)).toBeNull();
    expect(formatSoldCount(-3)).toBeNull();
  });
  it("mostra o número exato abaixo de 100", () => {
    expect(formatSoldCount(1)).toBe("1 vendido");
    expect(formatSoldCount(8)).toBe("8 vendidos");
    expect(formatSoldCount(57)).toBe("57 vendidos");
  });
  it("agrupa em faixas a partir de 100", () => {
    expect(formatSoldCount(100)).toBe("+100 vendidos");
    expect(formatSoldCount(499)).toBe("+100 vendidos");
    expect(formatSoldCount(500)).toBe("+500 vendidos");
    expect(formatSoldCount(1_234)).toBe("+1 mil vendidos");
    expect(formatSoldCount(10_000)).toBe("+10 mil vendidos");
    expect(formatSoldCount(250_000)).toBe("+100 mil vendidos");
  });
});
