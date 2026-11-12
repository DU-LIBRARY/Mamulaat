import { SALAH_NAMES, type SalahDay, type SalahStatus } from '../types';
import { adminStatus, SALAH_LABEL, STATUS_DESC, unloggedIsMissed } from '../lib/salah';
import { dayNumber, formatGregorian, shortDay } from '../lib/dates';
import { cellClass } from './ui';

/** Same palette as the mamool grid: done = green, partial = amber, missed = red; Takbir Ula gets gold. */
export const SALAH_CELL: Record<SalahStatus, string> = {
  takbir: 'bg-gold-400',
  jamaat: 'bg-green-300',
  qadha: 'bg-amber-100',
  missed: 'bg-red-300',
};
const NOT_LOGGED = cellClass(null);

const LEGEND: { cls: string; label: string }[] = [
  { cls: SALAH_CELL.takbir, label: 'Takbir Ula' },
  { cls: SALAH_CELL.jamaat, label: 'Jamaat' },
  { cls: SALAH_CELL.qadha, label: 'Qadha' },
  { cls: SALAH_CELL.missed, label: 'Missed' },
  { cls: NOT_LOGGED, label: 'Not logged' },
];

/**
 * A week of one student's salah: a row per prayer, a coloured cell per day (laid out like the
 * mamool grid). In the admin's view (`admin`), Takbir Ula shows as Jamaat, qadha as missed, and
 * so does nothing logged on a past day (from MISSED_RULE_FROM); today stays "not logged" until the day is over.
 */
export function SalahWeek({
  days,
  salah,
  today,
  onPick,
  admin = false,
}: {
  days: string[];
  salah: Map<string, SalahDay>;
  today: string;
  onPick?: (day: string) => void;
  admin?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-center text-[11px] num">
        <caption className="sr-only">
          Salah per day, {formatGregorian(days[0])} to {formatGregorian(days[days.length - 1])}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface text-left font-medium text-slate-500">
              Salah
            </th>
            {days.map((d) => {
              const label = (
                <>
                  <div>{shortDay(d)}</div>
                  <div className="text-sm">{dayNumber(d)}</div>
                </>
              );
              return (
                <th scope="col" key={d} className={`min-w-7 font-medium ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                  {onPick && d <= today ? (
                    <button type="button" className="min-h-11 w-full" onClick={() => onPick(d)}>
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SALAH_NAMES.map((n) => (
            <tr key={n}>
              <th scope="row" className="sticky left-0 z-10 max-w-24 truncate bg-surface pr-2 text-left text-sm font-normal text-slate-800">
                {SALAH_LABEL[n]}
              </th>
              {days.map((d) => {
                if (d > today) return <td key={d} className="h-9 rounded bg-transparent" />;
                const logged = salah.get(d)?.entries?.[n];
                const s = admin ? (adminStatus(logged) ?? (unloggedIsMissed(d, today) ? 'missed' : undefined)) : logged;
                const desc = s ? STATUS_DESC[s] : 'Not logged';
                return (
                  <td key={d} title={desc} className={`h-9 rounded ${s ? SALAH_CELL[s] : NOT_LOGGED}`}>
                    <span className="sr-only">{desc}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-slate-500" aria-hidden>
        {LEGEND.filter((l) => !admin || !['Not logged', 'Qadha', 'Takbir Ula'].includes(l.label)).map((l) => (
          <li key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${l.cls}`} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
