/** Formatação pt-BR: moeda (centavos → R$), datas no fuso America/Sao_Paulo. */

export const TZ = 'America/Sao_Paulo';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');
const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatBRL = (cents: number | null | undefined): string =>
  cents === null || cents === undefined || !Number.isFinite(cents) ? '—' : brl.format(cents / 100);

export const formatNumber = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? '—' : num.format(n));

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatDateTime = (v: string | Date | null | undefined): string => {
  const d = toDate(v);
  return d ? dateTime.format(d).replace(',', '') : '—';
};
export const formatDate = (v: string | Date | null | undefined): string => {
  const d = toDate(v);
  return d ? dateOnly.format(d) : '—';
};
export const formatDayMonth = (v: string | Date | null | undefined): string => {
  const d = toDate(v);
  return d ? dayMonth.format(d) : '—';
};
export const formatTime = (v: string | Date | null | undefined): string => {
  const d = toDate(v);
  return d ? timeOnly.format(d) : '—';
};

/** "há 5 min", "em 2 h" — apenas auxiliar; o valor exato vai no title. */
export function formatRelative(v: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return '—';
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

/** Data "YYYY-MM-DD" (série diária) → "dd/mm" sem deslocar de fuso. */
export function formatSeriesDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return m ? `${m[3]}/${m[2]}` : isoDate;
}

export const formatPct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${num.format(n)}%`);

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Aceita apenas http(s) para links exibidos (evita javascript: vindo de dados externos). */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
