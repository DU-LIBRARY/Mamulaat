import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { SALAH_NAMES, type SalahDay, type SalahStatus, type UserProfile } from '../types';
import { dayNumber, formatGregorian, shortDay } from '../lib/dates';
import { displayName, shortName } from '../lib/display';
import { missedCount, SALAH_LABEL, STATUS_DESC, unloggedIsMissed } from '../lib/salah';

/** F D A M I: Fajr, Dhuhr (Zuhr), Asr, Maghrib, Isha. */
const LETTER = ['F', 'D', 'A', 'M', 'I'];

function bar(s: SalahStatus | undefined, future: boolean, unloggedMissed: boolean) {
  if (future) return 'bg-transparent';
  if (!s && unloggedMissed) return 'bg-red-400'; // not logged on a day that's over counts as missed
  if (s === 'takbir') return 'bg-gold-400';
  if (s === 'jamaat') return 'bg-green-600';
  if (s === 'missed' || s === 'qadha') return 'bg-red-400';
  return 'bg-slate-200';
}

export interface RegisterGroup {
  key: string;
  label: string;
  students: UserProfile[];
}

/**
 * Every student's week of salah on one screen: a row per student, and for each day five thin
 * marks (F D A M I). Gold = Takbir Ula, green = Jamaat, red = missed, qadha or not logged on a
 * past day (from MISSED_RULE_FROM), grey = not logged. Each class lists its most-missed students first.
 */
export function SalahRegister({ days, groups, salah, today }: { days: string[]; groups: RegisterGroup[]; salah: Map<string, Map<string, SalahDay>>; today: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full max-w-[36rem] table-fixed border-separate border-spacing-x-[5px] border-spacing-y-[3px] sm:border-spacing-x-[8px]">
          {/* Names take what "First L" needs; the seven days share the rest, so the bars grow with the screen. */}
          <colgroup>
            <col className="w-[4.75rem]" />
            {days.map((d) => (
              <col key={d} />
            ))}
          </colgroup>
          <caption className="sr-only">
            Salah per student, {formatGregorian(days[0])} to {formatGregorian(days[6])}: for each day Fajr, Dhuhr, Asr, Maghrib and Isha
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface" />
              {days.map((d) => (
                <th scope="col" key={d} className={`px-0 text-[10px] leading-tight font-medium ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                  <div>{shortDay(d)}</div>
                  <div className="num text-[12px]">{dayNumber(d)}</div>
                  <div className="mt-0.5 flex gap-px text-[8px] leading-none font-normal text-slate-400" aria-hidden>
                    {LETTER.map((l, i) => (
                      <span key={i} className="flex-1 text-center">
                        {l}
                      </span>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <tr>
                  <th colSpan={8} scope="colgroup" className="pt-3 text-left text-[11px] font-medium text-slate-500" dir="auto">
                    {g.label} <span className="num font-normal">· {g.students.length}</span>
                  </th>
                </tr>
                {[...g.students]
                  .map((st) => ({ st, missed: missedCount(salah.get(st.id), days, today) }))
                  .sort((a, b) => b.missed - a.missed || displayName(a.st).localeCompare(displayName(b.st)))
                  .map(({ st }) => {
                  const by = salah.get(st.id);
                  return (
                    <tr key={st.id}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface pr-2 text-left text-[13px] font-normal text-slate-800" dir="auto">
                        <Link to={`/admin/student/${st.id}?tab=salah`} className="block truncate hover:underline" title={displayName(st)}>
                          {shortName(st)}
                        </Link>
                      </th>
                      {days.map((d) => {
                        const future = d > today;
                        return (
                          <td key={d} className="px-0">
                            <div className="flex gap-px">
                              {SALAH_NAMES.map((n) => {
                                const s = by?.get(d)?.entries?.[n];
                                return (
                                  <span
                                    key={n}
                                    className={`h-7 min-w-0 flex-1 rounded-[2px] ${bar(s, future, unloggedIsMissed(d, today))}`}
                                    title={future ? '' : `${SALAH_LABEL[n]}: ${s ? STATUS_DESC[s] : unloggedIsMissed(d, today) ? 'missed (not logged)' : 'not logged'}`}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500" aria-hidden>
        <span>F D A M I = Fajr, Dhuhr, Asr, Maghrib, Isha</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-gold-400" /> Takbir Ula</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-green-600" /> Jamaat</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-red-400" /> Missed or not logged</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-slate-200" /> Not logged</span>
      </div>
    </div>
  );
}
