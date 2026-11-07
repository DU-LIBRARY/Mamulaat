import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dayNumber, shortDay } from '../lib/dates';
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
      <table className="w-full border-separate border-spacing-0.5 text-center text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-sand-100 text-left font-semibold text-slate-500">{firstHeader}</th>
            {days.map((d) => (
              <th key={d} className={`min-w-7 font-semibold ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                <div>{shortDay(d)}</div>
                <div className="text-sm">{dayNumber(d)}</div>
              </th>
            ))}
            <th className="min-w-12 font-semibold text-slate-700">Week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th className="sticky left-0 z-10 max-w-24 truncate bg-sand-100 pr-2 text-left text-sm font-medium" dir="auto">
                {r.to ? (
                  <Link to={r.to} className="text-brand-700 underline-offset-2 hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </th>
              {r.cells.map((c, i) => (
                <td key={days[i]} className={`h-10 rounded-lg font-semibold ${days[i] > today ? 'bg-transparent text-slate-200' : cellClass(c)}`}>
                  {days[i] > today ? '' : c == null ? '–' : Math.round(c * 100)}
                </td>
              ))}
              <td className={`rounded-lg font-bold ${cellClass(r.total)}`}>{pct(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
