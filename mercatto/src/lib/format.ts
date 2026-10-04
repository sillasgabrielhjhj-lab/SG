const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const longDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
const shortDayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
const numberFmt = new Intl.NumberFormat("pt-BR");
const compactFmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** 04/10/2026 */
export const formatDate = (d: DateInput) => dateFmt.format(toDate(d));
/** 04/10/2026 18:30 */
export const formatDateTime = (d: DateInput) => dateTimeFmt.format(toDate(d)).replace(",", " às");
/** 4 de outubro de 2026 */
export const formatLongDate = (d: DateInput) => longDateFmt.format(toDate(d));
/** sáb., 4 de out. */
export const formatShortDay = (d: DateInput) => shortDayFmt.format(toDate(d));
/** 12.345 */
export const formatNumber = (n: number) => numberFmt.format(n);
/** 12,3 mil */
export const formatCompact = (n: number) => compactFmt.format(n);

/** "há 3 dias", "há 2 horas" */
export function formatRelative(d: DateInput, now: Date = new Date()): string {
  const diffMs = toDate(d).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), "month");
  return rtf.format(Math.round(diffMs / (365 * day)), "year");
}

/** Tempo de plataforma: "2 anos na Mercatto" */
export function formatMembership(since: DateInput, now: Date = new Date()): string {
  const months = Math.max(
    0,
    (now.getFullYear() - toDate(since).getFullYear()) * 12 + (now.getMonth() - toDate(since).getMonth()),
  );
  if (months < 1) return "Novo na Mercatto";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} na Mercatto`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "ano" : "anos"} na Mercatto`;
}

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** 01001000 -> 01001-000 */
export function formatCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** 12345678909 -> 123.456.789-09 */
export function formatCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** 12345678000195 -> 12.345.678/0001-95 */
export function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** 11987654321 -> (11) 98765-4321 */
export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Mascara CPF para exibição: ***.456.789-** */
export function maskCpf(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Mascara e-mail: jo***@gmail.com */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}
