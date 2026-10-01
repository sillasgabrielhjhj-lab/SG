import { siteConfig, type OpeningHours } from '@/config/site';

export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** Dia da semana e minutos desde a meia-noite no fuso da pizzaria. */
export function getZonedNow(date: Date, timeZone = siteConfig.timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: weekdayIndex[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function getWindow(entry: OpeningHours | undefined): [number, number] | null {
  if (!entry?.open || !entry.close) return null;
  const open = toMinutes(entry.open);
  let close = toMinutes(entry.close);
  if (close <= open) close += 24 * 60; // fecha depois da meia-noite
  return [open, close];
}

const hoursFor = (day: number) => siteConfig.hours.find((h) => h.day === day);

export function formatHoursRange(entry: OpeningHours | undefined): string {
  if (!entry?.open || !entry.close) return 'Closed';
  return `${entry.open} – ${entry.close}`;
}

export interface OpenStatus {
  isOpen: boolean;
  /** Ex.: "Open now" / "Closed now" */
  label: string;
  /** Ex.: "Closes at 23:00" / "Opens today at 18:00" */
  detail: string;
  today: number;
}

export function getOpenStatus(date: Date = new Date()): OpenStatus {
  const { day, minutes } = getZonedNow(date);

  const today = getWindow(hoursFor(day));
  if (today && minutes >= today[0] && minutes < today[1]) {
    return { isOpen: true, label: 'Open now', detail: `Closes at ${hoursFor(day)?.close}`, today: day };
  }

  // Expediente de ontem que atravessa a meia-noite
  const yesterdayDay = (day + 6) % 7;
  const yesterday = getWindow(hoursFor(yesterdayDay));
  if (yesterday && minutes + 24 * 60 >= yesterday[0] && minutes + 24 * 60 < yesterday[1]) {
    return {
      isOpen: true,
      label: 'Open now',
      detail: `Closes at ${hoursFor(yesterdayDay)?.close}`,
      today: day,
    };
  }

  if (today && minutes < today[0]) {
    return { isOpen: false, label: 'Closed now', detail: `Opens today at ${hoursFor(day)?.open}`, today: day };
  }

  for (let offset = 1; offset <= 7; offset++) {
    const next = (day + offset) % 7;
    const entry = hoursFor(next);
    if (getWindow(entry)) {
      const when = offset === 1 ? 'tomorrow' : `on ${weekdayNames[next]}`;
      return { isOpen: false, label: 'Closed now', detail: `Opens ${when} at ${entry?.open}`, today: day };
    }
  }

  return { isOpen: false, label: 'Closed', detail: 'See our opening hours', today: day };
}

/** Horários de segunda a domingo, para exibição. */
export function getWeekSchedule() {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day,
    name: weekdayNames[day],
    hours: formatHoursRange(hoursFor(day)),
    closed: !getWindow(hoursFor(day)),
  }));
}

/** Horários no formato schema.org (OpeningHoursSpecification). */
export function getSchemaOpeningHours() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return siteConfig.hours
    .filter((h) => h.open && h.close)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${days[h.day]}`,
      opens: h.open,
      closes: h.close,
    }));
}
