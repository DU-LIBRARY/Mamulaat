import { useMemo } from 'react';
import type { DayLog, Mamool, SalahDay } from '../types';
import { addDays, formatGregorian, weekDays, weekStartOf } from '../lib/dates';
import { pct, periodCompletion } from '../lib/scoring';
import { jamaatRate } from '../lib/salah';

export interface WeekPoint {
  /** First day of the week (YYYY-MM-DD). */
  start: string;
  /** 0..1, or null when there was nothing to count that week. */
  value: number | null;
}

/** Mid-tone steps of the week grid's scale, so bars read on light and dark surfaces alike. */
function barClass(f: number): string {
  if (f >= 1) return 'bg-green-600';
  if (f >= 0.5) return 'bg-brand-500';
  if (f > 0) return 'bg-amber-500';
  return 'bg-red-400';
}

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });

/**
 * A year at a glance: one bar per week, height for the share done and colour from the week grid's
 * scale (green all done, clay half or more, amber some, red none), with the year's overall figure beside the title. Hover/tap a bar for its week.
 */
export function YearChart({ title, weeks, total, today }: { title: string; weeks: WeekPoint[]; total: number | null; today: string }) {
  // Label the first week that starts in each quarter's opening month.
  const labels = new Map<number, string>();
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = Number(w.start.slice(5, 7)) - 1;
    const y = w.start.slice(0, 4);
    if (m !== lastMonth && m % 3 === 0 && y === weeks[weeks.length - 1].start.slice(0, 4)) labels.set(i, MONTH.format(new Date(Date.UTC(+y, m, 1))));
    lastMonth = m;
  });

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-[15px] text-slate-900">{title}</span>
        <span className="num font-serif text-[26px] leading-none text-slate-900">{pct(total)}</span>
      </figcaption>
      <div className="flex h-16 items-end gap-[2px]" aria-hidden>
        {weeks.map((w) => {
          const future = w.start > today;
          const label = `${formatGregorian(w.start, { weekday: undefined, year: undefined })} – ${formatGregorian(addDays(w.start, 6), { weekday: undefined, year: undefined })}: ${future ? 'not yet' : pct(w.value)}`;
          return (
            <div key={w.start} className="flex h-full min-w-0 flex-1 items-end" title={label}>
              {future ? (
                <span className="h-px w-full bg-slate-200" />
              ) : w.value == null ? (
                <span className="h-px w-full bg-slate-300" />
              ) : (
                <span
                  className={`w-full rounded-t-[2px] ${barClass(w.value)}`}
                  style={{ height: `${Math.max(6, Math.round(w.value * 100))}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="relative h-3 text-[10px] text-slate-500" aria-hidden>
        {[...labels].map(([i, l]) => (
          <span key={i} className="absolute" style={{ left: `${(i / weeks.length) * 100}%` }}>
            {l}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>
          {title}, by week. Year: {pct(total)}
        </caption>
        <tbody>
          {weeks
            .filter((w) => w.start <= today)
            .map((w) => (
              <tr key={w.start}>
                <th scope="row">Week of {formatGregorian(w.start)}</th>
                <td>{pct(w.value)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * One student's calendar year by week: mamoolaat completion and salah in jamaat, each with the
 * year's figure. Used on the student's Me tab and under the admin's week view of a student.
 */
export function YearSummary({
  today,
  weekStart,
  logs,
  mamoolaat,
  salah,
  quiet = false,
}: {
  today: string;
  weekStart: number;
  logs: Map<string, DayLog>;
  mamoolaat: Mamool[];
  salah: Map<string, SalahDay>;
  /** Secondary placement (admin): a smaller heading. */
  quiet?: boolean;
}) {
  const year = today.slice(0, 4);
  const data = useMemo(() => {
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const inYear = (d: string) => d >= first && d <= last;
    const salahFrom = [...salah.keys()].sort()[0] ?? null;
    const mamool: WeekPoint[] = [];
    const prayed: WeekPoint[] = [];
    const yearDays: string[] = [];
    for (let start = weekStartOf(first, weekStart); start <= last; start = addDays(start, 7)) {
      const days = weekDays(start).filter(inYear);
      yearDays.push(...days);
      mamool.push({ start, value: periodCompletion(days, logs, mamoolaat, today) });
      prayed.push({ start, value: jamaatRate(salah, days, today, salahFrom) });
    }
    return {
      mamool,
      prayed,
      mamoolTotal: periodCompletion(yearDays, logs, mamoolaat, today),
      salahTotal: jamaatRate(salah, yearDays, today, salahFrom),
    };
  }, [year, today, weekStart, logs, mamoolaat, salah]);

  return (
    <section className={`flex flex-col gap-5 ${quiet ? 'rounded-xl bg-surface p-4' : 'card'}`}>
      <h2 className="section-title -mb-2">{quiet ? `This year (${year})` : year}</h2>
      <YearChart title="Mamoolaat" weeks={data.mamool} total={data.mamoolTotal} today={today} />
      <YearChart title="Salah in jamaat" weeks={data.prayed} total={data.salahTotal} today={today} />
      <p className="-mt-2 text-xs text-slate-500">One bar per week. Salah counts from the first day logged; a day not logged counts as missed.</p>
    </section>
  );
}
