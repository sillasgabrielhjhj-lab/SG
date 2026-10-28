import { describe, expect, it } from "vitest";
import { fundraising } from "@/config/fundraising";
import { fundraisingView, resolveFundraising, sourceCaption } from "@/lib/fundraising";
import { formatDateBR, supportMessage } from "@/lib/fundraising/messages";
import { barWidthPercent, computeGoalProgress, formatPercent } from "@/lib/fundraising/progress";
import { reaisToCents } from "@/lib/money";
import { buildShareMessage, facebookShareUrl, whatsappShareUrl } from "@/lib/share";

const plain = (text: string) => text.replace(/\s/g, " ");
const empty = { goal: null as number | null, raised: null as number | null, updatedAt: "" };
const view = (config: Partial<typeof empty>, env = {}) =>
  fundraisingView(resolveFundraising({ ...empty, ...config }, env));

describe("configuração da meta", () => {
  it("o arquivo vem SEM valores: nenhum número inventado", () => {
    expect(fundraising.goal).toBeNull();
    expect(fundraising.raised).toBeNull();
    expect(view(fundraising)).toEqual({ kind: "objective" });
  });

  it("só a meta, só o arrecadado ou os dois", () => {
    expect(view({ goal: 15000 })).toEqual({ kind: "goal-only", goalCents: 1_500_000 });
    expect(view({ raised: 320.5 })).toEqual({ kind: "raised-only", raisedCents: 32_050 });
    const both = view({ goal: 15000, raised: 6000 });
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
    expect(() => resolveFundraising({ ...empty, goal: 0 })).toThrow(/maior que zero/);
    expect(() => resolveFundraising({ ...empty, raised: -1 })).toThrow(/maior ou igual a 0/);
    expect(() => resolveFundraising({ ...empty, updatedAt: "05/11/2026" })).toThrow(/AAAA-MM-DD/);
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

  it("mensagens sem número de doadores e com os valores configurados", () => {
    expect(plain(supportMessage(progress(7500, 20000)))).toBe(
      "💗 Graças à solidariedade de quem já contribuiu, chegamos a R$ 7,5 mil. Cada contribuição nos aproxima da meta de R$ 20 mil.",
    );
    expect(plain(supportMessage(progress(0, 20000)))).not.toContain("chegamos");
    expect(plain(supportMessage(progress(20000, 20000)))).toContain("foi alcançada");
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
