import { describe, expect, it } from "vitest";
import { fundraising } from "@/config/fundraising";
import { fundraisingView, resolveFundraising, sourceCaption } from "@/lib/fundraising";
import { formatDateBR, supportMessage } from "@/lib/fundraising/messages";
import { barWidthPercent, computeGoalProgress, formatPercent } from "@/lib/fundraising/progress";
import { reaisToCents } from "@/lib/money";
import { buildShareMessage, facebookShareUrl, whatsappShareUrl } from "@/lib/share";

const plain = (text: string) => text.replace(/\s/g, " ");
const empty = {
  valorArrecadado: null as number | null,
  metaArrecadacao: null as number | null,
  atualizadoEm: "",
};
const view = (config: Partial<typeof empty>, env = {}) =>
  fundraisingView(resolveFundraising({ ...empty, ...config }, env));

describe("configuração da meta", () => {
  it("dados oficiais: R$ 16.000 de R$ 30.000 = 53,3% (barra 53,33%), faltam R$ 14.000", () => {
    expect(fundraising.valorArrecadado).toBe(16000);
    expect(fundraising.metaArrecadacao).toBe(30000);
    const official = view(fundraising);
    expect(official.kind).toBe("progress");
    if (official.kind !== "progress") return;
    expect(formatPercent(official.progress.percentTenths)).toBe("53,3");
    expect(barWidthPercent(official.progress)).toBe(53.33);
    expect(official.progress.remainingCents).toBe(1_400_000);
    expect(plain(supportMessage(official.progress))).toBe(
      "❤️ Já percorremos mais da metade dessa caminhada! Graças à solidariedade de tantas pessoas, alcançamos R$ 16 mil. Mas ainda precisamos da sua ajuda. Cada contribuição representa mais apoio, cuidado e esperança para a May.",
    );
  });

  it("sem valores: só o objetivo; só a meta; só o arrecadado; os dois", () => {
    expect(view({})).toEqual({ kind: "objective" });
    expect(view({ metaArrecadacao: 15000 })).toEqual({ kind: "goal-only", goalCents: 1_500_000 });
    expect(view({ valorArrecadado: 320.5 })).toEqual({ kind: "raised-only", raisedCents: 32_050 });
    const both = view({ metaArrecadacao: 15000, valorArrecadado: 6000 });
    expect(both.kind).toBe("progress");
    if (both.kind === "progress") expect(formatPercent(both.progress.percentTenths)).toBe("40");
  });

  it("variáveis de ambiente têm prioridade e aceitam vírgula decimal", () => {
    const snapshot = resolveFundraising(empty, {
      FUNDRAISING_GOAL: "20000",
      FUNDRAISING_RAISED: "7500,50",
      FUNDRAISING_UPDATED_AT: "2026-11-05",
    });
    expect(snapshot).toMatchObject({
      goalCents: 2_000_000,
      raisedCents: 750_050,
      updatedAt: "2026-11-05",
    });
  });

  it("valores inválidos interrompem o build com mensagem clara", () => {
    expect(() => resolveFundraising(empty, { FUNDRAISING_GOAL: "15.000" })).toThrow(/milhar/);
    expect(() => resolveFundraising(empty, { FUNDRAISING_GOAL: "abc" })).toThrow(
      /FUNDRAISING_GOAL/,
    );
    expect(() => resolveFundraising({ ...empty, metaArrecadacao: 0 })).toThrow(/maior que zero/);
    expect(() => resolveFundraising({ ...empty, valorArrecadado: -1 })).toThrow(
      /maior ou igual a 0/,
    );
    expect(() => resolveFundraising({ ...empty, atualizadoEm: "05/11/2026" })).toThrow(
      /AAAA-MM-DD/,
    );
  });
});

describe("cálculo do progresso", () => {
  const progress = (raised: number, goal: number) =>
    computeGoalProgress({ raisedCents: reaisToCents(raised)!, goalCents: reaisToCents(goal)! })!;

  it("porcentagem, restante e barra", () => {
    const p = progress(7500, 20000);
    expect(formatPercent(p.percentTenths)).toBe("37,5");
    expect(p.remainingCents).toBe(1_250_000);
    expect(barWidthPercent(p)).toBe(37.5);
  });

  it("nunca exagera: arredonda para baixo e limita a barra a 100%", () => {
    expect(formatPercent(progress(19999.99, 20000).percentTenths)).toBe("99,9");
    const over = progress(22000, 20000);
    expect(over).toMatchObject({ reached: true, remainingCents: 0 });
    expect(barWidthPercent(over)).toBe(100);
  });

  it("mensagem acompanha os valores: abaixo da metade, metade, meta atingida, zero", () => {
    expect(plain(supportMessage(progress(7500, 20000)))).toBe(
      "❤️ Graças à solidariedade de tantas pessoas, alcançamos R$ 7,5 mil. Mas ainda precisamos da sua ajuda. Cada contribuição representa mais apoio, cuidado e esperança para a May.",
    );
    expect(supportMessage(progress(10000, 20000))).toContain("Já percorremos metade");
    expect(plain(supportMessage(progress(20000, 20000)))).toContain(
      "alcançamos a meta de R$ 20 mil",
    );
    expect(supportMessage(progress(0, 20000))).not.toContain("alcançamos");
  });

  it("legenda de transparência", () => {
    expect(sourceCaption("manual")).toContain("informados pelos responsáveis");
    expect(sourceCaption("manual")).toContain("não consulta o banco nem confirma pagamentos");
    expect(sourceCaption("manual", "05/11/2026")).toContain("atualizados em 05/11/2026");
    expect(formatDateBR("2026-11-05")).toBe("05/11/2026");
  });
});

describe("compartilhamento", () => {
  it("texto pronto exatamente como definido pela campanha", () => {
    expect(buildShareMessage("https://exemplo.com")).toBe(
      [
        "💗 AJUDE MAY NESSA CAMINHADA",
        "May enfrenta diariamente os desafios de conviver com uma condição rara e precisa de cuidados e acompanhamento contínuos.",
        "Sua solidariedade pode ajudar a proporcionar mais conforto, segurança e qualidade de vida.",
        "🙏 Qualquer valor faz a diferença.",
        "❤️ Doe ou compartilhe essa campanha.",
        "🔗 https://exemplo.com",
      ].join("\n"),
    );
  });

  it("codifica os links do WhatsApp e do Facebook", () => {
    expect(whatsappShareUrl("a b\nc")).toBe("https://wa.me/?text=a%20b%0Ac");
    expect(facebookShareUrl("https://exemplo.com/?a=1")).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexemplo.com%2F%3Fa%3D1",
    );
  });
});
