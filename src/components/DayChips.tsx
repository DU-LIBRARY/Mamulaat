import { Link } from 'react-router-dom';
import { addDays, dayNumber, formatGregorian, lastEditableDay, shortDay } from '../lib/dates';

/**
 * The row of day buttons at the top of the Log and Salah pages: today and the days before it
 * that can still be filled in (or `count` days, for read-only views).
 */
export function DayChips({
  day,
  today,
  backfillDays,
  hrefFor,
  count,
  showLocks = true,
}: {
  day: string;
  today: string;
  backfillDays: number;
  hrefFor: (d: string) => string;
  count?: number;
  showLocks?: boolean;
}) {
  const chips = Array.from({ length: count ?? backfillDays + 1 }, (_, i) => addDays(today, -i)).reverse();
  const locksTonight = (d: string) => showLocks && d !== today && lastEditableDay(d, backfillDays) === today;
  return (
    <nav aria-label="Days" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {chips.map((d) => (
        <Link
          key={d}
          to={hrefFor(d)}
          aria-current={d === day ? 'page' : undefined}
          aria-label={`${formatGregorian(d)}${d === today ? ' (today)' : ''}${locksTonight(d) ? ', locks tonight' : ''}`}
          className={`flex min-w-14 flex-col items-center rounded-md border px-3 py-1.5 text-xs font-medium ${
            d === day ? 'border-primary bg-primary text-on-primary' : 'border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
          }`}
        >
          <span>{d === today ? 'Today' : shortDay(d)}</span>
          <span className="num text-lg leading-tight font-semibold">{dayNumber(d)}</span>
          {locksTonight(d) && <span className={`text-[11px] ${d === day ? 'text-on-primary' : 'text-amber-800'}`}>locks tonight</span>}
        </Link>
      ))}
    </nav>
  );
}
