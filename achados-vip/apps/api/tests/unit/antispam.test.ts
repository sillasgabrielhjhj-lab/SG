import { describe, expect, it } from 'vitest';
import { decidePublishWindow, decideRepublish, isInQuietHours, isValidTimeZone, startOfLocalDay, type PublishWindowContext } from '../../src/domain/antispam.js';
import { defaultSettings, type Settings } from '../../src/domain/settings.js';

// America/Sao_Paulo = UTC-3 o ano todo (sem horário de verão desde 2019)
const z = (iso: string) => new Date(iso);
const iso = (d: Date | undefined) => d?.toISOString();

function mk(patch: Partial<Settings['publishing']> = {}, quiet: Partial<Settings['publishing']['quietHours']> = {}): Settings {
  const s = defaultSettings();
  s.publishing = { ...s.publishing, ...patch, quietHours: { ...s.publishing.quietHours, ...quiet } };
  return s;
}
/** Contexto livre de bloqueios; sobrescreva o que quiser testar. */
function ctx(over: Partial<PublishWindowContext> = {}, settings: Settings = mk()): PublishWindowContext {
  return { now: z('2026-10-17T15:00:00Z'), settings, lastPublishedAt: null, publishedLastHour: 0, publishedToday: 0, publishedTodayInCategory: 0, ...over };
}

describe('horário de silêncio', () => {
  // padrão: 00:00–07:00 America/Sao_Paulo
  it('dentro da janela => bloqueia e informa quando termina', () => {
    const r = decidePublishWindow(ctx({ now: z('2026-10-17T05:00:00Z') })); // 02:00 local
    expect(r).toMatchObject({ allowed: false, code: 'OUT_OF_WINDOW' });
    expect(r.reason).toContain('silêncio');
    expect(iso(r.nextAllowedAt)).toBe('2026-10-17T10:00:00.000Z'); // 07:00 local
  });
  it('limites: 00:00 bloqueado, 06:59:59 bloqueado, 07:00 liberado, 23:59 liberado', () => {
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T03:00:00Z') })).allowed).toBe(false); // 00:00 local
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T09:59:59Z') })).allowed).toBe(false); // 06:59:59
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T10:00:00Z') })).allowed).toBe(true); // 07:00
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T02:59:59Z') })).allowed).toBe(true); // 23:59:59 do dia anterior
  });
  it('janela que cruza a meia-noite (22:00–07:00)', () => {
    const s = mk({}, { start: '22:00', end: '07:00' });
    const at = (t: string) => decidePublishWindow(ctx({ now: z(t) }, s));
    expect(at('2026-10-17T00:59:00Z').allowed).toBe(true); // 21:59 local
    const night = at('2026-10-17T01:00:00Z'); // 22:00 local
    expect(night.allowed).toBe(false);
    expect(iso(night.nextAllowedAt)).toBe('2026-10-17T10:00:00.000Z'); // 07:00 do dia seguinte
    const lateNight = at('2026-10-17T02:30:00Z'); // 23:30 local
    expect(iso(lateNight.nextAllowedAt)).toBe('2026-10-17T10:00:00.000Z');
    const earlyMorning = at('2026-10-17T08:00:00Z'); // 05:00 local
    expect(earlyMorning.allowed).toBe(false);
    expect(iso(earlyMorning.nextAllowedAt)).toBe('2026-10-17T10:00:00.000Z');
    expect(at('2026-10-17T10:00:00Z').allowed).toBe(true); // 07:00 local
  });
  it('nextAllowedAt devolvido está fora do silêncio', () => {
    const s = mk({}, { start: '22:00', end: '07:00' });
    for (const t of ['2026-10-17T01:00:00Z', '2026-10-17T03:15:00Z', '2026-10-17T09:59:00Z']) {
      const r = decidePublishWindow(ctx({ now: z(t) }, s));
      expect(r.nextAllowedAt).toBeDefined();
      expect(decidePublishWindow(ctx({ now: r.nextAllowedAt! }, s)).allowed).toBe(true);
    }
  });
  it('desativado => ignora o horário', () => {
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T05:00:00Z') }, mk({}, { enabled: false }))).allowed).toBe(true);
  });
  it('start == end => janela vazia (sem silêncio)', () => {
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T05:00:00Z') }, mk({}, { start: '08:00', end: '08:00' }))).allowed).toBe(true);
  });
  it('respeita o fuso IANA configurado (UTC vs. São Paulo)', () => {
    const now = z('2026-10-17T05:00:00Z'); // 02:00 SP, 05:00 UTC
    expect(decidePublishWindow(ctx({ now }, mk({}, { timezone: 'America/Sao_Paulo' }))).allowed).toBe(false);
    const utc = decidePublishWindow(ctx({ now }, mk({}, { timezone: 'UTC' })));
    expect(utc.allowed).toBe(false);
    expect(iso(utc.nextAllowedAt)).toBe('2026-10-17T07:00:00.000Z');
    expect(decidePublishWindow(ctx({ now }, mk({}, { timezone: 'Asia/Tokyo' }))).allowed).toBe(true); // 14:00 em Tóquio
  });
  it('fuso com horário de verão: usa o deslocamento correto (New York, verão e inverno)', () => {
    const s = mk({}, { start: '23:00', end: '06:00', timezone: 'America/New_York' });
    const summer = decidePublishWindow(ctx({ now: z('2026-07-15T04:00:00Z') }, s)); // 00:00 EDT (UTC-4)
    expect(summer.allowed).toBe(false);
    expect(iso(summer.nextAllowedAt)).toBe('2026-07-15T10:00:00.000Z');
    const winter = decidePublishWindow(ctx({ now: z('2026-01-15T05:00:00Z') }, s)); // 00:00 EST (UTC-5)
    expect(winter.allowed).toBe(false);
    expect(iso(winter.nextAllowedAt)).toBe('2026-01-15T11:00:00.000Z');
  });
  it('término do silêncio no dia da virada do horário de verão (07:00 já em EDT)', () => {
    const s = mk({}, { start: '00:00', end: '07:00', timezone: 'America/New_York' });
    const r = decidePublishWindow(ctx({ now: z('2026-03-08T06:00:00Z') }, s)); // 01:00 EST, antes da virada
    expect(r.allowed).toBe(false);
    expect(iso(r.nextAllowedAt)).toBe('2026-03-08T11:00:00.000Z'); // 07:00 EDT
  });
  it('fuso inválido com silêncio ativo => bloqueia (falha fechada) sem lançar', () => {
    const r = decidePublishWindow(ctx({}, mk({}, { timezone: 'Marte/Phobos' })));
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('inválid');
  });
  it('fuso inválido com silêncio desativado não bloqueia', () => {
    expect(decidePublishWindow(ctx({}, mk({}, { enabled: false, timezone: 'Marte/Phobos' }))).allowed).toBe(true);
  });
  it('horário HH:MM malformado (config corrompida) bloqueia', () => {
    expect(decidePublishWindow(ctx({}, mk({}, { start: '7h' }))).allowed).toBe(false);
  });
  it('isInQuietHours / isValidTimeZone', () => {
    const q = mk().publishing.quietHours;
    expect(isInQuietHours(z('2026-10-17T05:00:00Z'), q)).toBe(true);
    expect(isInQuietHours(z('2026-10-17T15:00:00Z'), q)).toBe(false);
    expect(isInQuietHours(z('2026-10-17T05:00:00Z'), { ...q, enabled: false })).toBe(false);
    expect(isInQuietHours(z('2026-10-17T05:00:00Z'), { ...q, timezone: 'x/y' })).toBe(false);
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Nao/Existe')).toBe(false);
  });
});

describe('intervalo mínimo', () => {
  const s = mk({ minIntervalMinutes: 30 }, { enabled: false });
  const now = z('2026-10-17T15:00:00Z');
  it('bloqueia antes do intervalo e informa quando libera', () => {
    const r = decidePublishWindow(ctx({ now, lastPublishedAt: z('2026-10-17T14:40:00Z') }, s));
    expect(r).toMatchObject({ allowed: false, code: 'LIMIT_REACHED' });
    expect(r.reason).toContain('30 min');
    expect(iso(r.nextAllowedAt)).toBe('2026-10-17T15:10:00.000Z');
  });
  it('libera exatamente no limite', () => {
    expect(decidePublishWindow(ctx({ now, lastPublishedAt: z('2026-10-17T14:30:00Z') }, s)).allowed).toBe(true);
  });
  it('sem publicação anterior ou intervalo 0 => livre', () => {
    expect(decidePublishWindow(ctx({ now, lastPublishedAt: null }, s)).allowed).toBe(true);
    expect(decidePublishWindow(ctx({ now, lastPublishedAt: z('2026-10-17T14:59:59Z') }, mk({ minIntervalMinutes: 0 }, { enabled: false }))).allowed).toBe(true);
  });
  it('se o fim do intervalo cai no silêncio, nextAllowedAt vai para o fim do silêncio', () => {
    const sq = mk({ minIntervalMinutes: 60 }); // silêncio 00:00–07:00 SP
    const r = decidePublishWindow(ctx({ now: z('2026-10-17T02:50:00Z'), lastPublishedAt: z('2026-10-17T02:30:00Z') }, sq)); // 23:50 local; libera 00:30 (silêncio)
    expect(r.allowed).toBe(false);
    expect(iso(r.nextAllowedAt)).toBe('2026-10-17T10:00:00.000Z');
  });
});

describe('limite por hora, por dia e por categoria', () => {
  const s = mk({ maxPerHour: 2, maxPerDay: 5, maxPerCategoryPerDay: 3, minIntervalMinutes: 0 }, { enabled: false });
  it('hora: bloqueia ao atingir (sem nextAllowedAt calculável)', () => {
    expect(decidePublishWindow(ctx({ publishedLastHour: 1 }, s)).allowed).toBe(true);
    const r = decidePublishWindow(ctx({ publishedLastHour: 2 }, s));
    expect(r).toMatchObject({ allowed: false, code: 'LIMIT_REACHED' });
    expect(r.reason).toContain('por hora');
    expect(r.nextAllowedAt).toBeUndefined();
  });
  it('dia: bloqueia e aponta a próxima meia-noite local', () => {
    expect(decidePublishWindow(ctx({ publishedToday: 4 }, s)).allowed).toBe(true);
    const r = decidePublishWindow(ctx({ publishedToday: 5 }, s));
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('por dia');
    expect(iso(r.nextAllowedAt)).toBe('2026-10-18T03:00:00.000Z'); // 00:00 de 18/10 em SP
  });
  it('dia: próxima meia-noite cai no silêncio => vai para o fim do silêncio', () => {
    const sq = mk({ maxPerDay: 5, minIntervalMinutes: 0 }); // silêncio padrão ativo
    const r = decidePublishWindow(ctx({ publishedToday: 5 }, sq));
    expect(iso(r.nextAllowedAt)).toBe('2026-10-18T10:00:00.000Z'); // 07:00 de 18/10
  });
  it('categoria: usa limite global por padrão', () => {
    expect(decidePublishWindow(ctx({ publishedTodayInCategory: 2 }, s)).allowed).toBe(true);
    const r = decidePublishWindow(ctx({ publishedTodayInCategory: 3 }, s));
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('categoria');
    expect(iso(r.nextAllowedAt)).toBe('2026-10-18T03:00:00.000Z');
  });
  it('categoria: limite específico da categoria sobrepõe o global', () => {
    expect(decidePublishWindow(ctx({ publishedTodayInCategory: 3, categoryDailyLimit: 6 }, s)).allowed).toBe(true);
    expect(decidePublishWindow(ctx({ publishedTodayInCategory: 1, categoryDailyLimit: 1 }, s)).allowed).toBe(false);
    expect(decidePublishWindow(ctx({ publishedTodayInCategory: 0, categoryDailyLimit: 0 }, s)).allowed).toBe(false);
    expect(decidePublishWindow(ctx({ publishedTodayInCategory: 3, categoryDailyLimit: null }, s)).allowed).toBe(false);
  });
  it('ordem: silêncio > intervalo > hora > dia > categoria', () => {
    const all = mk({ maxPerHour: 1, maxPerDay: 1, maxPerCategoryPerDay: 1, minIntervalMinutes: 30 });
    const bad = { lastPublishedAt: z('2026-10-17T05:00:00Z'), publishedLastHour: 9, publishedToday: 9, publishedTodayInCategory: 9 };
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T05:10:00Z'), ...bad }, all)).code).toBe('OUT_OF_WINDOW');
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T15:10:00Z'), ...bad, lastPublishedAt: z('2026-10-17T15:00:00Z') }, all)).reason).toContain('Intervalo');
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T15:10:00Z'), ...bad }, all)).reason).toContain('por hora');
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T15:10:00Z'), ...bad, publishedLastHour: 0 }, all)).reason).toContain('por dia');
    expect(decidePublishWindow(ctx({ now: z('2026-10-17T15:10:00Z'), ...bad, publishedLastHour: 0, publishedToday: 0 }, all)).reason).toContain('categoria');
  });
  it('tudo dentro dos limites => permitido sem motivo', () => {
    expect(decidePublishWindow(ctx())).toEqual({ allowed: true });
  });
  it('fuso inválido com silêncio desativado: limites diários bloqueiam sem nextAllowedAt', () => {
    const bad = mk({ maxPerDay: 1, minIntervalMinutes: 0 }, { enabled: false, timezone: 'x/y' });
    const r = decidePublishWindow(ctx({ publishedToday: 1 }, bad));
    expect(r.allowed).toBe(false);
    expect(r.nextAllowedAt).toBeUndefined();
  });
});

describe('startOfLocalDay', () => {
  it('início do dia civil no fuso (SP, UTC-3)', () => {
    expect(iso(startOfLocalDay(z('2026-10-17T15:00:00Z'), 'America/Sao_Paulo'))).toBe('2026-10-17T03:00:00.000Z');
    expect(iso(startOfLocalDay(z('2026-10-17T02:00:00Z'), 'America/Sao_Paulo'))).toBe('2026-10-16T03:00:00.000Z'); // ainda é dia 16 em SP
    expect(iso(startOfLocalDay(z('2026-10-17T15:00:00Z'), 'UTC'))).toBe('2026-10-17T00:00:00.000Z');
  });
});

describe('decideRepublish', () => {
  const s = defaultSettings(); // 7 dias, queda adicional mínima 10%
  const now = z('2026-10-17T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const run = (lastDaysAgo: number | null, last: number | null, current: number, settings = s) =>
    decideRepublish({ lastPublishedAt: lastDaysAgo === null ? null : daysAgo(lastDaysAgo), lastPublishedPriceCents: last, currentPriceCents: current, now }, settings);

  it('nunca publicada => liberada', () => {
    expect(run(null, null, 10000).allowed).toBe(true);
  });
  it('após 7 dias => liberada (inclusive no limite exato), mesmo sem queda', () => {
    expect(run(7, 10000, 10000).allowed).toBe(true);
    expect(run(30, 10000, 12000).allowed).toBe(true);
  });
  it('antes de 7 dias sem queda adicional => bloqueada', () => {
    const r = run(3, 10000, 10000);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('7 dia');
    expect(run(6.9, 10000, 12000).allowed).toBe(false); // preço subiu
  });
  it('antes de 7 dias, queda abaixo do mínimo => bloqueada', () => {
    expect(run(2, 10000, 9100).allowed).toBe(false); // 9%
    expect(run(2, 10000, 9100).reason).toContain('9%');
  });
  it('antes de 7 dias, queda >= 10% => liberada (limite exato inclusive)', () => {
    expect(run(2, 10000, 9000).allowed).toBe(true); // exatamente 10%
    expect(run(2, 10000, 8000).allowed).toBe(true);
    expect(run(2, 10000, 8000).reason).toContain('20%');
  });
  it('precisão em centavos no limite (sem erro de ponto flutuante)', () => {
    expect(run(1, 29990, 26991).allowed).toBe(true); // 10,0003%
    expect(run(1, 29990, 26992).allowed).toBe(false); // 9,9967%
  });
  it('sem preço publicado conhecido (antes do prazo) => bloqueia por segurança', () => {
    expect(run(2, null, 5000).allowed).toBe(false);
    expect(run(2, 0, 5000).allowed).toBe(false);
  });
  it('preço atual inválido => bloqueia', () => {
    expect(run(2, 10000, 0).allowed).toBe(false);
    expect(run(2, 10000, Number.NaN).allowed).toBe(false);
  });
  it('configurações customizadas', () => {
    const c = mk({ republishAfterDays: 14, republishMinAdditionalDropPct: 25 });
    expect(run(10, 10000, 8000, c).allowed).toBe(false); // 20% < 25%
    expect(run(10, 10000, 7500, c).allowed).toBe(true);
    expect(run(14, 10000, 10000, c).allowed).toBe(true);
    expect(run(13.9, 10000, 10000, c).allowed).toBe(false);
  });
  it('republishAfterDays = 0 => sempre liberada', () => {
    expect(run(0, 10000, 10000, mk({ republishAfterDays: 0 })).allowed).toBe(true);
  });
  it('queda mínima 0% libera qualquer queda, mas não preço igual/maior', () => {
    const c = mk({ republishMinAdditionalDropPct: 0 });
    expect(run(1, 10000, 9999, c).allowed).toBe(true);
    expect(run(1, 10000, 10000, c).allowed).toBe(false);
    expect(run(1, 10000, 11000, c).allowed).toBe(false);
  });
  it('data da última publicação no futuro (relógio incoerente) não libera por prazo', () => {
    expect(run(-1, 10000, 10000).allowed).toBe(false);
  });
});
