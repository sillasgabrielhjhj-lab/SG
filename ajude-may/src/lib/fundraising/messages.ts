import { formatBRLCompact } from "@/lib/money";
import type { GoalProgress } from "./progress";

/** Mensagem de agradecimento. Sem números de doadores: só os valores configurados. */
export function supportMessage(progress: GoalProgress): string {
  const goal = formatBRLCompact(progress.goalCents);
  if (progress.reached) {
    return `💗 Graças à solidariedade de quem contribuiu, a meta de ${goal} foi alcançada. Obrigado por caminhar com a May!`;
  }
  if (progress.raisedCents === 0) {
    return `💗 Cada contribuição nos aproxima da meta de ${goal}. Obrigado por caminhar com a May!`;
  }
  const raised = formatBRLCompact(progress.raisedCents);
  return `💗 Graças à solidariedade de quem já contribuiu, chegamos a ${raised}. Cada contribuição nos aproxima da meta de ${goal}.`;
}

/** "2026-10-27" -> "27/10/2026" (sem fuso horário). */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
