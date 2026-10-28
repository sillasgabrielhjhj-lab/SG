export interface GoalProgress {
  raisedCents: number;
  goalCents: number;
  remainingCents: number;
  /** Porcentagem em décimos (440 = 44,0%), sempre arredondada PARA BAIXO: nunca mostramos mais do que foi alcançado. */
  percentTenths: number;
  reached: boolean;
}

const isCents = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Calcula progresso, restante e porcentagem a partir dos totais (em centavos). Meta inválida = null. */
export function computeGoalProgress(input: {
  raisedCents: number;
  goalCents: number;
}): GoalProgress | null {
  const { raisedCents, goalCents } = input;
  if (!isCents(raisedCents) || !isCents(goalCents) || goalCents === 0) return null;
  return {
    raisedCents,
    goalCents,
    remainingCents: Math.max(goalCents - raisedCents, 0),
    percentTenths: Math.floor((raisedCents * 1000) / goalCents),
    reached: raisedCents >= goalCents,
  };
}

/** 440 -> "44", 445 -> "44,5" */
export function formatPercent(tenths: number): string {
  const whole = Math.floor(tenths / 10);
  const decimal = tenths % 10;
  return decimal === 0 ? `${whole}` : `${whole},${decimal}`;
}

/** Largura da barra (0 a 100): fiel à porcentagem real, sem passar de 100%. */
export function barWidthPercent(progress: GoalProgress): number {
  return Math.min(progress.percentTenths, 1000) / 10;
}
