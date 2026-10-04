import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  bestInterestFreeInstallment,
  discountPercent,
  formatBRL,
  installmentOptions,
  parseBRL,
  percentOf,
} from "@/lib/money";

describe("money", () => {
  it("formata BRL a partir de centavos", () => {
    expect(formatBRL(129990)).toBe("R$ 1.299,90");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });

  it("converte entradas humanas para centavos sem erro de ponto flutuante", () => {
    expect(parseBRL("1.299,90")).toBe(129990);
    expect(parseBRL("R$ 10")).toBe(1000);
    expect(parseBRL("0,1")).toBe(10);
    expect(parseBRL("19.99")).toBe(1999);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("")).toBeNull();
    expect(parseBRL(0.1 + 0.2)).toBe(30);
  });

  it("calcula percentuais arredondando ao centavo", () => {
    expect(percentOf(999, 10)).toBe(100);
    expect(discountPercent(10000, 7990)).toBe(20);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(discountPercent(0, 10)).toBe(0);
  });

  it("distribui valores proporcionalmente sem perder centavos", () => {
    const parts = allocateProportionally(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportionally(100, [0, 0])).toEqual([0, 0]);
  });

  it("gera parcelamento sem juros e com juros (Tabela Price)", () => {
    const opts = installmentOptions(120000);
    expect(opts[0]).toMatchObject({ count: 1, installmentCents: 120000, interestFree: true });
    expect(opts.find((o) => o.count === 10)).toMatchObject({ installmentCents: 12000, interestFree: true });
    const twelve = opts.find((o) => o.count === 12)!;
    expect(twelve.interestFree).toBe(false);
    expect(twelve.totalCents).toBeGreaterThan(120000);
    expect(bestInterestFreeInstallment(120000)?.count).toBe(10);
  });

  it("respeita a parcela mínima", () => {
    const opts = installmentOptions(1500); // R$ 15,00 -> parcela mínima R$ 5,00
    expect(opts.map((o) => o.count)).toEqual([1, 2, 3]);
  });
});
