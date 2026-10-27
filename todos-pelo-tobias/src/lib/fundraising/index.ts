import { fundraising } from "@/config/fundraising";
import { reaisToCents } from "@/lib/money";

/** De onde vem o total: informado manualmente pela organização ou confirmado via integração bancária. */
export type FundraisingSource = "manual" | "bank";

export interface FundraisingSnapshot {
  raisedCents: number;
  goalCents: number;
  source: FundraisingSource;
  /** Data da última atualização (AAAA-MM-DD), quando conhecida. */
  updatedAt?: string;
}

/**
 * Ponto ÚNICO de leitura do total arrecadado. Hoje: o valor informado pela organização em
 * src/config/fundraising.ts.
 *
 * Integração bancária futura: troque o corpo desta função para consultar a sua API Pix/conta
 * (somente pagamentos CONFIRMADOS, nunca ações do visitante) e devolva `source: "bank"`; a tela já
 * adapta o texto de transparência. Para atualizar sem novo deploy, use `export const revalidate = 300`
 * em src/app/page.tsx.
 */
export async function getFundraising(): Promise<FundraisingSnapshot | null> {
  if (!fundraising.enabled) return null;

  const raisedCents = reaisToCents(fundraising.raised);
  const goalCents = reaisToCents(fundraising.goal);
  if (raisedCents === null || goalCents === null || goalCents === 0) {
    throw new Error(
      "Meta de arrecadação inválida em src/config/fundraising.ts: `raised` deve ser um número maior ou igual a 0 e `goal` maior que 0 (em reais).",
    );
  }
  if (fundraising.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(fundraising.updatedAt)) {
    throw new Error(
      '`updatedAt` em src/config/fundraising.ts deve estar no formato AAAA-MM-DD, ex.: "2026-10-27".',
    );
  }

  return {
    raisedCents,
    goalCents,
    source: "manual",
    updatedAt: fundraising.updatedAt || undefined,
  };
}

/** Texto de transparência: deixa claro de onde vem o número e o que o site NÃO faz. */
export function sourceCaption(source: FundraisingSource, updatedAtLabel?: string): string {
  const when = updatedAtLabel ? `, atualizado em ${updatedAtLabel}` : "";
  return source === "bank"
    ? `Total confirmado automaticamente a partir dos pagamentos recebidos${when}.`
    : `Total informado pela organização da campanha${when}. Este site não consulta o banco nem confirma pagamentos.`;
}
