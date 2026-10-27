import { describe, expect, it } from "vitest";
import { sourceCaption } from "@/lib/fundraising";
import { supportMessage, formatDateBR } from "@/lib/fundraising/messages";
import { barWidthPercent, computeGoalProgress, formatPercent } from "@/lib/fundraising/progress";
import { formatBRLCompact, reaisToCents } from "@/lib/money";

const plain = (text: string) => text.replace(/\s/g, " ");
const progress = (raised: number, goal: number) =>
  computeGoalProgress({ raisedCents: reaisToCents(raised)!, goalCents: reaisToCents(goal)! });

describe("reaisToCents", () => {
  it("converte reais em centavos inteiros", () => {
    expect(reaisToCents(22000)).toBe(2_200_000);
    expect(reaisToCents(50000)).toBe(5_000_000);
    expect(reaisToCents(22350.5)).toBe(2_235_050);
    expect(reaisToCents(1.005)).toBe(101);
    expect(reaisToCents(0)).toBe(0);
  });
  it("recusa negativo, NaN e infinito", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(reaisToCents(bad)).toBeNull();
  });
});

describe("computeGoalProgress (R$ 22.000 de R$ 50.000)", () => {
  it("calcula 44%, restante de R$ 28.000 e barra em 44%", () => {
    const p = progress(22000, 50000)!;
    expect(p.percentTenths).toBe(440);
    expect(formatPercent(p.percentTenths)).toBe("44");
    expect(p.remainingCents).toBe(2_800_000);
    expect(p.reached).toBe(false);
    expect(barWidthPercent(p)).toBe(44);
  });

  it("acompanha qualquer atualização do valor arrecadado", () => {
    expect(formatPercent(progress(25000, 50000)!.percentTenths)).toBe("50");
    expect(progress(25000, 50000)!.remainingCents).toBe(2_500_000);
    expect(formatPercent(progress(31250, 50000)!.percentTenths)).toBe("62,5");
    expect(progress(0, 50000)).toMatchObject({
      percentTenths: 0,
      remainingCents: 5_000_000,
      reached: false,
    });
  });

  it("nunca exagera: arredonda para baixo e não mostra 100% antes da meta", () => {
    const almost = progress(49999.99, 50000)!;
    expect(formatPercent(almost.percentTenths)).toBe("99,9");
    expect(almost.reached).toBe(false);
    expect(barWidthPercent(almost)).toBeLessThan(100);
    expect(formatPercent(progress(100, 50000)!.percentTenths)).toBe("0,2");
  });

  it("meta atingida ou superada: barra limitada a 100%, restante zero", () => {
    const equal = progress(50000, 50000)!;
    expect(equal).toMatchObject({ percentTenths: 1000, remainingCents: 0, reached: true });
    const over = progress(55000, 50000)!;
    expect(over.reached).toBe(true);
    expect(over.remainingCents).toBe(0);
    expect(formatPercent(over.percentTenths)).toBe("110");
    expect(barWidthPercent(over)).toBe(100);
  });

  it("meta inválida (zero, negativa, não inteira) não gera cálculo", () => {
    expect(computeGoalProgress({ raisedCents: 100, goalCents: 0 })).toBeNull();
    expect(computeGoalProgress({ raisedCents: -1, goalCents: 100 })).toBeNull();
    expect(computeGoalProgress({ raisedCents: 1.5, goalCents: 100 })).toBeNull();
    expect(computeGoalProgress({ raisedCents: 1, goalCents: Number.NaN })).toBeNull();
  });
});

describe("formatBRLCompact", () => {
  it.each([
    [22000, "R$ 22 mil"],
    [50000, "R$ 50 mil"],
    [22500, "R$ 22,5 mil"],
    [22350, "R$ 22,35 mil"],
    [1000, "R$ 1 mil"],
    [1_000_000, "R$ 1 milhão"],
    [1_500_000, "R$ 1,5 milhão"],
    [2_500_000, "R$ 2,5 milhões"],
    [950, "R$ 950,00"],
    [22350.5, "R$ 22.350,50"], // não cabe exatamente: mostra completo, sem arredondar
    [1_234_567, "R$ 1.234.567,00"],
  ])("%d -> %s", (reais, expected) => {
    expect(plain(formatBRLCompact(reaisToCents(reais)!))).toBe(expected);
  });
});

describe("textos do card", () => {
  it("mensagem de transparência com os valores da campanha (exatamente como pedido)", () => {
    expect(plain(supportMessage(progress(22000, 50000)!))).toBe(
      "💚 Graças à solidariedade de tantas pessoas, já alcançamos R$ 22 mil. Cada contribuição nos aproxima da nossa meta de R$ 50 mil. Juntos pelo Tobias!",
    );
  });

  it("a mensagem acompanha a atualização dos valores", () => {
    expect(plain(supportMessage(progress(30000, 60000)!))).toContain("já alcançamos R$ 30 mil");
    expect(plain(supportMessage(progress(30000, 60000)!))).toContain("meta de R$ 60 mil");
  });

  it("variações: sem arrecadação ainda e meta atingida", () => {
    expect(plain(supportMessage(progress(0, 50000)!))).not.toContain("já alcançamos");
    expect(plain(supportMessage(progress(50000, 50000)!))).toContain(
      "alcançamos nossa meta de R$ 50 mil",
    );
  });

  it("legenda deixa claro que o total é informado pela organização e que o site não confirma pagamentos", () => {
    expect(sourceCaption("manual")).toContain("informado pela organização da campanha");
    expect(sourceCaption("manual")).toContain("não consulta o banco nem confirma pagamentos");
    expect(sourceCaption("manual", "27/10/2026")).toContain("atualizado em 27/10/2026");
    expect(sourceCaption("bank")).not.toContain("informado pela organização");
    expect(formatDateBR("2026-10-27")).toBe("27/10/2026");
  });
});
