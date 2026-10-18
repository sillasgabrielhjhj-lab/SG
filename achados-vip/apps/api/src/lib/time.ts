/** Utilitários de tempo (puros). Datas sempre como Date/ISO; fuso horário via Intl (sem dependências). */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const now = (): Date => new Date();
export const addMs = (d: Date, ms: number): Date => new Date(d.getTime() + ms);
export const addMinutes = (d: Date, n: number): Date => addMs(d, n * MINUTE_MS);
export const addHours = (d: Date, n: number): Date => addMs(d, n * HOUR_MS);
export const addDays = (d: Date, n: number): Date => addMs(d, n * DAY_MS);
export const minutesBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / MINUTE_MS;
export const toISO = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rejeita se `p` não resolver em `ms` milissegundos (a operação original não é cancelada). */
export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operação'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Componentes de data/hora de um instante no fuso `tz`. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return {
    year: p.year ?? 0,
    month: p.month ?? 0,
    day: p.day ?? 0,
    hour: (p.hour ?? 0) % 24,
    minute: p.minute ?? 0,
    second: p.second ?? 0,
  };
}

/** Diferença (ms) entre a hora local em `tz` e UTC naquele instante. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Chave "YYYY-MM-DD" do dia local em `tz`. */
export function dayKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Minutos desde a meia-noite local em `tz` (0..1439). */
export function minutesOfDayInTz(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  return p.hour * 60 + p.minute;
}

/** Instante UTC da meia-noite local (início do dia) de `date` em `tz`. */
export function startOfDayInTz(date: Date, tz: string): Date {
  const p = zonedParts(date, tz);
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  let result = guess - tzOffsetMs(new Date(guess), tz);
  // reajusta caso o offset mude entre o palpite e o resultado (horário de verão)
  const second = guess - tzOffsetMs(new Date(result), tz);
  if (second !== result) result = second;
  return new Date(result);
}
