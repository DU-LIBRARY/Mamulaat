import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dayNumber, formatGregorian, shortDay } from '../lib/dates';
import { pct } from '../lib/scoring';
import { cellClass } from './ui';

export interface GridRow {
  key: string;
  label: ReactNode;
  to?: string;
  cells: (number | null)[]; // completion 0..1 per day, null = not applicable / future
  total: number | null;
}

/** Rows × days grid with completion percentages (students × days, or mamool × days). */
export function WeekGrid({ days, rows, today, firstHeader }: { days: string[]; rows: GridRow[]; today: string; firstHeader: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-center text-[11px] num">
        <caption className="sr-only">
          Percent completed per day, {formatGregorian(days[0])} to {formatGregorian(days[days.length - 1])}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-white text-left font-medium text-slate-500">{firstHeader}</th>
            {days.map((d) => (
              <th scope="col" key={d} className={`min-w-7 font-medium ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                <div>{shortDay(d)}</div>
                <div className="text-sm">{dayNumber(d)}</div>
              </th>
            ))}
            <th scope="col" className="min-w-12 font-medium text-slate-700">Week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="sticky left-0 z-10 max-w-24 truncate bg-white pr-2 text-left text-sm font-normal text-slate-800" dir="auto">
                {r.to ? (
                  <Link to={r.to} className="text-brand-700 underline-offset-2 hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </th>
              {r.cells.map((c, i) => (
                <td key={days[i]} className={`h-9 rounded font-medium ${days[i] > today ? 'bg-transparent text-slate-300' : cellClass(c)}`}>
                  {days[i] > today ? '' : c == null ? <span title="nothing to do">–</span> : `${Math.round(c * 100)}`}
                  {days[i] <= today && c != null && <span className="sr-only">%</span>}
                  {days[i] <= today && c == null && <span className="sr-only">nothing to do</span>}
                </td>
              ))}
              <td className={`rounded font-semibold ${cellClass(r.total)}`}>{pct(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
