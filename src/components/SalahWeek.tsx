import { SALAH_NAMES, type SalahDay, type SalahStatus } from '../types';
import { SALAH_LABEL, STATUS_DESC } from '../lib/salah';
import { shortDay, dayNumber } from '../lib/dates';

const CELL: Record<SalahStatus, { cls: string; short: string }> = {
  takbir: { cls: 'bg-gold-50 text-gold-900', short: 'T' },
  jamaat: { cls: 'bg-green-100 text-green-800', short: 'J' },
  qadha: { cls: 'bg-amber-100 text-amber-900', short: 'Q' },
  missed: { cls: 'bg-red-100 text-red-800', short: 'M' },
};

/** A week of one student's salah: a row per prayer, a cell per day. */
export function SalahWeek({ days, salah, today, onPick }: { days: string[]; salah: Map<string, SalahDay>; today: string; onPick?: (day: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th scope="col" className="text-left font-medium text-slate-500">
              Salah
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className={`font-medium ${d === today ? 'text-slate-900' : 'text-slate-500'}`}>
                {onPick && d <= today ? (
                  <button type="button" className="min-h-11 w-full" onClick={() => onPick(d)}>
                    {shortDay(d)} <span className="num">{dayNumber(d)}</span>
                  </button>
                ) : (
                  <>
                    {shortDay(d)} <span className="num">{dayNumber(d)}</span>
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SALAH_NAMES.map((n) => (
            <tr key={n}>
              <th scope="row" className="pr-2 text-left font-normal text-slate-800">
                {SALAH_LABEL[n]}
              </th>
              {days.map((d) => {
                const s = salah.get(d)?.entries?.[n];
                const future = d > today;
                return (
                  <td
                    key={d}
                    title={future ? '' : s ? STATUS_DESC[s] : 'Not logged'}
                    className={`h-9 rounded-md font-medium ${future ? '' : s ? CELL[s].cls : 'border border-slate-200 text-slate-400'}`}
                  >
                    <span aria-hidden>{future ? '' : s ? CELL[s].short : '–'}</span>
                    <span className="sr-only">{future ? '' : s ? STATUS_DESC[s] : 'not logged'}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">T = Takbir Ula · J = Jamaat · Q = Qadha · M = Missed · – = not logged</p>
    </div>
  );
}
