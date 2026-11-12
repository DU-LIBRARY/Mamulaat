import { addDays, formatGregorian } from '../lib/dates';
import { pct } from '../lib/scoring';

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
