import { fundraising } from "@/config/fundraising";
import { reaisToCents } from "@/lib/money";
import { computeGoalProgress, type GoalProgress } from "./progress";

/** De onde vem o total: informado pelos responsáveis ou confirmado via integração bancária. */
export type FundraisingSource = "manual" | "bank";

export interface FundraisingSnapshot {
  goalCents: number | null;
  raisedCents: number | null;
  source: FundraisingSource;
  /** Data da última atualização (AAAA-MM-DD), quando conhecida. */
  updatedAt?: string;
}

/** O que a tela mostra, conforme os dados que já foram configurados. */
export type FundraisingView =
  | { kind: "objective" }
  | { kind: "goal-only"; goalCents: number }
  | { kind: "raised-only"; raisedCents: number }
  | { kind: "progress"; progress: GoalProgress };

type Amount = number | string | null | undefined;

const fail = (message: string): never => {
  throw new Error(`Meta de arrecadação inválida (src/config/fundraising.ts): ${message}`);
};

/** Reais (número do arquivo ou texto da variável de ambiente) -> centavos; vazio = null. */
function toCents(name: string, value: Amount): number | null {
  if (value === null || value === undefined || value === "") return null;
  let reais = value;
  if (typeof reais === "string") {
    // "15.000" é ambíguo (15 mil ou 15 reais?): só aceitamos até 2 casas decimais, sem milhar.
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(reais.trim())) {
      fail(
        `${name} = "${value}". Use apenas números, ex.: 15000 ou 15000,50 (sem ponto de milhar).`,
      );
    }
    reais = Number(reais.trim().replace(",", "."));
  }
  const cents = reaisToCents(reais as number);
  if (cents === null) fail(`${name} deve ser um número maior ou igual a 0 (em reais).`);
  return cents;
}

/** Junta arquivo + variáveis de ambiente e valida (erros interrompem o build com mensagem clara). */
export function resolveFundraising(
  config: { valorArrecadado: Amount; metaArrecadacao: Amount; atualizadoEm: string },
  env: Record<string, string | undefined> = {},
): FundraisingSnapshot {
  const goalCents = toCents(
    "metaArrecadacao / FUNDRAISING_GOAL",
    env.FUNDRAISING_GOAL || config.metaArrecadacao,
  );
  const raisedCents = toCents(
    "valorArrecadado / FUNDRAISING_RAISED",
    env.FUNDRAISING_RAISED || config.valorArrecadado,
  );
  const updatedAt = env.FUNDRAISING_UPDATED_AT || config.atualizadoEm;
  if (goalCents === 0) fail("a meta (metaArrecadacao) deve ser maior que zero.");
  if (updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) {
    fail(`atualizadoEm deve estar no formato AAAA-MM-DD, ex.: "2026-11-05".`);
  }
  return { goalCents, raisedCents, source: "manual", updatedAt: updatedAt || undefined };
}

/**
 * Ponto ÚNICO de leitura do total arrecadado. Para uma integração bancária futura, consulte aqui a
 * sua API Pix (somente pagamentos CONFIRMADOS) e devolva `source: "bank"`.
 */
export async function getFundraising(): Promise<FundraisingSnapshot> {
  return resolveFundraising(fundraising, process.env);
}

export function fundraisingView(snapshot: FundraisingSnapshot): FundraisingView {
  const { goalCents, raisedCents } = snapshot;
  if (goalCents !== null && raisedCents !== null) {
    const progress = computeGoalProgress({ goalCents, raisedCents });
    if (progress) return { kind: "progress", progress };
  }
  if (goalCents !== null) return { kind: "goal-only", goalCents };
  if (raisedCents !== null) return { kind: "raised-only", raisedCents };
  return { kind: "objective" };
}

/** Texto de transparência: deixa claro de onde vem o número e o que o site NÃO faz. */
export function sourceCaption(source: FundraisingSource, updatedAtLabel?: string): string {
  const when = updatedAtLabel ? `, atualizados em ${updatedAtLabel}` : "";
  return source === "bank"
    ? `Valores confirmados automaticamente a partir dos pagamentos recebidos${when}.`
    : `Valores informados pelos responsáveis pela campanha${when}. Este site não consulta o banco nem confirma pagamentos.`;
}
