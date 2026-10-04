/**
 * Datas de formulários (input datetime-local) são interpretadas no fuso de
 * Brasília. O Brasil não adota horário de verão desde 2019 (UTC-03:00 fixo).
 * Regiões com outro fuso (ex.: Manaus) devem ser consideradas se a operação
 * exigir — por padrão a loja opera no horário de Brasília.
 */
const BRT_OFFSET = "-03:00";

/** "2026-10-05T10:00" (horário de Brasília) -> Date (UTC). */
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}${BRT_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date -> "2026-10-05T10:00" no horário de Brasília (para preencher inputs). */
export function toLocalInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(new Date(date).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
