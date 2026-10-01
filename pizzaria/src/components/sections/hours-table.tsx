'use client';

import { useOpenStatus } from '@/hooks/use-open-status';
import { getWeekSchedule } from '@/lib/hours';
import { cn } from '@/lib/utils';

const schedule = getWeekSchedule();

export function HoursTable() {
  const status = useOpenStatus();
  return (
    <table className="w-full text-[0.9375rem]">
      <caption className="sr-only">Horário de funcionamento</caption>
      <tbody>
        {schedule.map((row) => {
          const isToday = status?.today === row.day;
          return (
            <tr key={row.day} className={cn('border-b border-ink-900/[0.06] last:border-0', isToday && 'font-semibold')}>
              <th scope="row" className={cn('py-2.5 text-left font-medium', isToday ? 'text-ink-900' : 'text-ink-600')}>
                {row.name}
                {isToday && <span className="ml-2 rounded-full bg-tomato-50 px-2 py-0.5 text-[0.6875rem] font-bold text-tomato-700 uppercase">Hoje</span>}
              </th>
              <td className={cn('py-2.5 text-right tabular-nums', row.closed ? 'text-ink-400' : 'text-ink-900')}>{row.hours}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
