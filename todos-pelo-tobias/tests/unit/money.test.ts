import { describe, expect, it } from "vitest";
import { formatBRL, parseAmountInput } from "@/lib/money";

const limits = { minCents: 1, maxCents: 9_999_999 };
const cents = (raw: string) => {
  const result = parseAmountInput(raw, limits);
  return result.ok ? result.cents : result.error;
};

describe("parseAmountInput", () => {
  it.each([
    ["5", 500],
    ["50", 5000],
    ["25,5", 2550],
    ["25,50", 2550],
    ["25.50", 2550],
    ["25.5", 2550],
    ["0,01", 1],
    ["0,5", 50],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["R$ 10,00", 1000],
    ["  7,  ", 700],
    ["007", 700],
    ["99999,99", 9_999_999],
  ])("aceita %j -> %i centavos", (raw, expected) => {
    expect(cents(raw)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-5", "negative"],
    ["-0,50", "negative"],
    ["0", "zero"],
    ["0,00", "zero"],
    ["abc", "invalid"],
    ["10 reais", "invalid"],
    ["1e3", "invalid"],
    ["1,2,3", "invalid"],
    [",50", "invalid"],
    ["10,555", "decimals"],
    ["0.500", "decimals"],
    ["100000", "max"],
    ["99999,991", "decimals"],
    ["99999999999999999999", "max"],
  ])("recusa %j (%s)", (raw, error) => {
    expect(cents(raw)).toBe(error);
  });

  it("não perde centavos em valores que o ponto flutuante erra (1,15 · 4,35 · 8,2)", () => {
    expect(cents("1,15")).toBe(115);
    expect(cents("4,35")).toBe(435);
    expect(cents("8,2")).toBe(820);
  });
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(5000).replace(/\s/g, " ")).toBe("R$ 50,00");
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatBRL(1).replace(/\s/g, " ")).toBe("R$ 0,01");
  });
});
