/**
 * Controle de frequência (puro): horário de silêncio por fuso IANA, intervalo mínimo, limites por hora/dia/categoria
 * e regra de republicação. Sem Date.now(): quem chama passa `now` e as contagens.
 *
 * "Dia" = dia civil no fuso de settings.publishing.quietHours.timezone (use `startOfLocalDay` para contar `publishedToday`).
 * `nextAllowedAt` é a próxima reavaliação útil (já fora do silêncio), não uma garantia de liberação; ausente quando
 * não dá para calcular só com os dados do contexto (limite/hora e limite/categoria dependem dos horários publicados).
 */
import type { Settings } from './settings.js';

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

export interface PublishWindowContext {
  now: Date;
  settings: Settings;
  lastPublishedAt: Date | null;
  publishedLastHour: number;
  publishedToday: number;
  publishedTodayInCategory: number;
  /** Limite diário específico da categoria; null/undefined => settings.publishing.maxPerCategoryPerDay. */
  categoryDailyLimit?: number | null;
}

export interface PublishWindowDecision {
  allowed: boolean;
  reason?: string;
  /** Mapeia para PublishBlockedError.code */
  code?: 'OUT_OF_WINDOW' | 'LIMIT_REACHED';
  nextAllowedAt?: Date;
}

// ---------- fuso horário (Intl, sem libs) ----------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(date: Date, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return { year: out.year!, month: out.month!, day: out.day!, hour: out.hour! % 24, minute: out.minute!, second: out.second! };
}

/** Deslocamento (ms) do fuso em relação a UTC no instante dado. */
function offsetMs(instantMs: number, timeZone: string): number {
  const p = localParts(new Date(instantMs), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instantMs / 1000) * 1000;
}

/** Horário local (parede) => instante UTC. Dia/mês podem "transbordar" (ex.: dia+1). */
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(guess, timeZone);
  const second = guess - offsetMs(first, timeZone); // reajusta se cruzou mudança de horário de verão
  return new Date(second);
}

/** Início (00:00 local) do dia civil de `now` no fuso informado. Use para contar publishedToday. */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

function nextLocalMidnight(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return zonedToUtc(p.year, p.month, p.day + 1, 0, 0, timeZone);
}

// ---------- horário de silêncio ----------

type QuietHours = Settings['publishing']['quietHours'];

function parseHHMM(s: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/**
 * Se `at` está dentro do silêncio, devolve o instante em que ele termina; senão null.
 * Janela [start, end): suporta cruzar a meia-noite (22:00–07:00). start == end => janela vazia (sem silêncio).
 * Pré-condição: fuso válido e horários HH:MM válidos.
 */
function quietEndsAt(at: Date, q: QuietHours): Date | null {
  const start = parseHHMM(q.start);
  const end = parseHHMM(q.end);
  if (start === end) return null;
  const p = localParts(at, q.timezone);
  const t = p.hour * 60 + p.minute;
  const inside = start < end ? t >= start && t < end : t >= start || t < end;
  if (!inside) return null;
  const dayOffset = t < end ? 0 : 1; // já passou do "end" de hoje => termina amanhã
  return zonedToUtc(p.year, p.month, p.day + dayOffset, Math.floor(end / 60), end % 60, q.timezone);
}

export function isInQuietHours(at: Date, q: QuietHours): boolean {
  return q.enabled && isValidTimeZone(q.timezone) && quietEndsAt(at, q) !== null;
}

// ---------- decisão de publicação ----------

export function decidePublishWindow(ctx: PublishWindowContext): PublishWindowDecision {
  const { now, settings, lastPublishedAt } = ctx;
  const p = settings.publishing;
  const q = p.quietHours;
  const tzOk = isValidTimeZone(q.timezone);

  if (q.enabled && (!tzOk || Number.isNaN(parseHHMM(q.start)) || Number.isNaN(parseHHMM(q.end)))) {
    // falha fechada: configuração inválida nunca libera a publicação
    return { allowed: false, code: 'OUT_OF_WINDOW', reason: 'Horário de silêncio com fuso ou horários inválidos nas configurações' };
  }

  /** Empurra um instante candidato para fora do silêncio (se cair nele). */
  const settle = (candidate: Date): Date => (q.enabled ? (quietEndsAt(candidate, q) ?? candidate) : candidate);
  const blocked = (code: 'OUT_OF_WINDOW' | 'LIMIT_REACHED', reason: string, next?: Date): PublishWindowDecision => ({
    allowed: false,
    code,
    reason,
    ...(next ? { nextAllowedAt: settle(next) } : {}),
  });

  // 1) horário de silêncio
  if (q.enabled) {
    const end = quietEndsAt(now, q);
    if (end) return { allowed: false, code: 'OUT_OF_WINDOW', reason: `Horário de silêncio (${q.start}–${q.end}, ${q.timezone})`, nextAllowedAt: end };
  }

  // 2) intervalo mínimo desde a última publicação
  if (lastPublishedAt && p.minIntervalMinutes > 0) {
    const next = new Date(lastPublishedAt.getTime() + p.minIntervalMinutes * MIN_MS);
    if (now.getTime() < next.getTime()) return blocked('LIMIT_REACHED', `Intervalo mínimo de ${p.minIntervalMinutes} min entre publicações`, next);
  }

  // 3) limite por hora (janela móvel; sem horários não há como calcular nextAllowedAt)
  if (ctx.publishedLastHour >= p.maxPerHour) return blocked('LIMIT_REACHED', `Limite de ${p.maxPerHour} publicação(ões) por hora atingido`);

  // 4) limite por dia civil
  const dayReset = tzOk ? nextLocalMidnight(now, q.timezone) : undefined;
  if (ctx.publishedToday >= p.maxPerDay) return blocked('LIMIT_REACHED', `Limite de ${p.maxPerDay} publicação(ões) por dia atingido`, dayReset);

  // 5) limite por categoria/dia
  const catLimit = ctx.categoryDailyLimit ?? p.maxPerCategoryPerDay;
  if (ctx.publishedTodayInCategory >= catLimit) return blocked('LIMIT_REACHED', `Limite de ${catLimit} publicação(ões) por dia na categoria atingido`, dayReset);

  return { allowed: true };
}

// ---------- republicação ----------

export interface RepublishContext {
  lastPublishedAt: Date | null;
  lastPublishedPriceCents: number | null;
  currentPriceCents: number;
  now: Date;
}

/**
 * Nunca publicada => liberada. Passados `republishAfterDays` => liberada.
 * Antes disso, só com queda adicional >= republishMinAdditionalDropPct vs. o preço publicado (sem preço publicado: bloqueia).
 */
export function decideRepublish(ctx: RepublishContext, settings: Settings): { allowed: boolean; reason: string } {
  const { lastPublishedAt, lastPublishedPriceCents, currentPriceCents, now } = ctx;
  const { republishAfterDays, republishMinAdditionalDropPct } = settings.publishing;
  if (!lastPublishedAt) return { allowed: true, reason: 'Oferta ainda não publicada' };

  const elapsedDays = (now.getTime() - lastPublishedAt.getTime()) / DAY_MS;
  if (elapsedDays >= republishAfterDays) return { allowed: true, reason: `Prazo de ${republishAfterDays} dia(s) desde a última publicação cumprido` };

  const last = lastPublishedPriceCents;
  if (!last || last <= 0 || !Number.isFinite(currentPriceCents) || currentPriceCents <= 0) {
    return { allowed: false, reason: `Publicada há menos de ${republishAfterDays} dia(s) e sem preço publicado para comparar` };
  }
  // aritmética inteira evita erro de ponto flutuante no limite exato (ex.: 10%)
  if ((last - currentPriceCents) * 100 >= republishMinAdditionalDropPct * last && currentPriceCents < last) {
    const drop = Math.round(((last - currentPriceCents) / last) * 100);
    return { allowed: true, reason: `Queda adicional de ${drop}% desde a última publicação (mínimo ${republishMinAdditionalDropPct}%)` };
  }
  const drop = currentPriceCents < last ? Math.round(((last - currentPriceCents) / last) * 1000) / 10 : 0;
  return { allowed: false, reason: `Publicada há menos de ${republishAfterDays} dia(s) e a queda adicional (${drop}%) é menor que ${republishMinAdditionalDropPct}%` };
}
