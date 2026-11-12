import { Link } from 'react-router-dom';
import type { SalahDay, SalahStatus, UserProfile } from '../types';
import { dayNumber, formatGregorian, shortDay } from '../lib/dates';
import { displayName } from '../lib/display';
import { STATUS_DESC } from '../lib/salah';
import { IconCheck, IconX } from './icons';

/** Gold tick: from the opening takbir. Green tick: in jamaat. Red ✗: missed or qadha. Dot: not logged. */
function Mark({ s }: { s: SalahStatus | undefined }) {
  if (s === 'takbir') return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-[#2a2410]"><IconCheck size={13} weight="bold" /></span>;
  if (s === 'jamaat') return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-800"><IconCheck size={13} weight="bold" /></span>;
  if (s === 'missed' || s === 'qadha') return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-800"><IconX size={12} weight="bold" /></span>;
  return <span className="inline-flex h-6 w-6 items-center justify-center text-slate-400">·</span>;
}

/** Students × days, Fajr only. */
export function FajrWeekGrid({ days, students, salah, today }: { days: string[]; students: UserProfile[]; salah: Map<string, Map<string, SalahDay>>; today: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[3px] text-center text-[11px]">
          <caption className="sr-only">
            Fajr per student, {formatGregorian(days[0])} to {formatGregorian(days[days.length - 1])}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface text-left font-medium text-slate-500">
                Student
              </th>
              {days.map((d) => (
                <th scope="col" key={d} className={`min-w-6 font-medium ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                  <div>{shortDay(d)}</div>
                  <div className="num text-sm">{dayNumber(d)}</div>
                </th>
              ))}
              <th scope="col" className="min-w-8 font-medium text-slate-700">
                <span aria-hidden>✓</span>
                <span className="sr-only">Days in jamaat</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const by = salah.get(st.id);
              const past = days.filter((d) => d <= today);
              const inJamaat = past.filter((d) => ['takbir', 'jamaat'].includes(by?.get(d)?.entries?.fajr ?? '')).length;
              return (
                <tr key={st.id}>
                  <th scope="row" className="sticky left-0 z-10 max-w-24 truncate bg-surface pr-2 text-left text-sm font-normal text-slate-800" dir="auto">
                    <Link to={`/admin/student/${st.id}?tab=salah`} className="hover:underline">
                      {displayName(st)}
                    </Link>
                  </th>
                  {days.map((d) => {
                    const s = by?.get(d)?.entries?.fajr;
                    const future = d > today;
                    return (
                      <td key={d} title={future ? '' : s ? STATUS_DESC[s] : 'Not logged'}>
                        {future ? null : <Mark s={s} />}
                        <span className="sr-only">{future ? 'not yet' : s ? STATUS_DESC[s] : 'not logged'}</span>
                      </td>
                    );
                  })}
                  <td className="num text-sm text-slate-700">
                    {inJamaat}/{past.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><Mark s="takbir" /> Takbir</span>
        <span className="inline-flex items-center gap-1.5"><Mark s="jamaat" /> Jamaat</span>
        <span className="inline-flex items-center gap-1.5"><Mark s="missed" /> Missed or qadha</span>
        <span className="inline-flex items-center gap-1.5"><Mark s={undefined} /> Not logged</span>
      </div>
    </div>
  );
}
