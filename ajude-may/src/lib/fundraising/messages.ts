import { formatBRLCompact } from "@/lib/money";
import type { GoalProgress } from "./progress";

/** Mensagem abaixo da barra. Os valores vêm da configuração, então acompanham qualquer atualização. */
export function supportMessage(progress: GoalProgress): string {
  const raised = formatBRLCompact(progress.raisedCents);
  if (progress.reached) {
    return `❤️ Graças à solidariedade de tantas pessoas, alcançamos a meta de ${formatBRLCompact(progress.goalCents)}! Muito obrigado por caminhar com a May.`;
  }
  if (progress.raisedCents === 0) {
    return "❤️ Cada contribuição representa mais apoio, cuidado e esperança para a May. Faça parte dessa caminhada!";
  }
  const double = progress.raisedCents * 2;
  const half =
    double > progress.goalCents
      ? "Já percorremos mais da metade dessa caminhada! "
      : double === progress.goalCents
        ? "Já percorremos metade dessa caminhada! "
        : "";
  return `❤️ ${half}Graças à solidariedade de tantas pessoas, alcançamos ${raised}. Mas ainda precisamos da sua ajuda. Cada contribuição representa mais apoio, cuidado e esperança para a May.`;
}

/** "2026-10-27" -> "27/10/2026" (sem fuso horário). */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
