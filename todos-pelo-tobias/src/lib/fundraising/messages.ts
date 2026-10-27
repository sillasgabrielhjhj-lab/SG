import { formatBRLCompact } from "@/lib/money";
import type { GoalProgress } from "./progress";

/** Mensagem de agradecimento do card. Os valores vêm da configuração, então acompanham qualquer atualização. */
export function supportMessage(progress: GoalProgress): string {
  const goal = formatBRLCompact(progress.goalCents);
  if (progress.reached) {
    return `💚 Graças à solidariedade de tantas pessoas, alcançamos nossa meta de ${goal}. Muito obrigado a todos! Juntos pelo Tobias!`;
  }
  if (progress.raisedCents === 0) {
    return `💚 Cada contribuição nos aproxima da nossa meta de ${goal}. Juntos pelo Tobias!`;
  }
  const raised = formatBRLCompact(progress.raisedCents);
  return `💚 Graças à solidariedade de tantas pessoas, já alcançamos ${raised}. Cada contribuição nos aproxima da nossa meta de ${goal}. Juntos pelo Tobias!`;
}

/** "2026-10-27" -> "27/10/2026" (sem fuso horário). */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
