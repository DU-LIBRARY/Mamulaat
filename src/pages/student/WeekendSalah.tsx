import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useActiveSession } from '../../hooks/useSession';
import { useDocData } from '../../hooks/useFirestore';
import { Notice, Spinner } from '../../components/ui';
import { IconChevronLeft, IconChevronRight } from '../../components/icons';
import { bar } from '../../components/SalahRegister';
import { addDays, formatGregorian, formatHijri, isValidYmd, weekendOf } from '../../lib/dates';
import { rosterRef, salahRef } from '../../lib/db';
import { adminStatus, missedCount, SALAH_LABEL, STATUS_DESC, unloggedIsMissed } from '../../lib/salah';
import { SALAH_NAMES, type ClassRoster, type SalahDay } from '../../types';
import { useRepClasses } from './Salah';

const LETTER = ['F', 'D', 'A', 'M', 'I'];

interface SheetState {
  salah: Map<string, Map<string, SalahDay>>;
  /** Docs that have arrived (2 per student when everything is in). */
  arrived: number;
  failed: number;
}

/**
 * Live Saturday and Sunday salah of every student on the roster. The rules let the weekend rep
 * fetch these one day at a time (never query them), so it's two document listeners per student.
 */
function useWeekendSalah(uids: string[], days: string[]) {
  const key = `${uids.join(',')}|${days.join(',')}`;
  const [state, setState] = useState<SheetState>({ salah: new Map(), arrived: 0, failed: 0 });
  useEffect(() => {
    setState({ salah: new Map(), arrived: 0, failed: 0 });
    const unsubs = uids.flatMap((uid) =>
      days.map((day) => {
        let seen = false;
        // Count each listener's first answer once (outside the state updater, which may run twice).
        const first = () => {
          const n = seen ? 0 : 1;
          seen = true;
          return n;
        };
        return onSnapshot(
          salahRef(uid, day),
          (s) => {
            const n = first();
            const rec = s.exists() ? ({ id: s.id, ...s.data() } as SalahDay) : null;
            setState((prev) => {
              const salah = new Map(prev.salah);
              const by = new Map(salah.get(uid) ?? []);
              if (rec) by.set(day, rec);
              else by.delete(day);
              salah.set(uid, by);
              return { ...prev, salah, arrived: prev.arrived + n };
            });
          },
          () => {
            const n = first();
            setState((prev) => ({ ...prev, failed: prev.failed + n }));
          },
        );
      }),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Salah counted so far: every salah of a day that's over, and only what's logged today. */
function counted(by: Map<string, SalahDay> | undefined, days: string[], today: string) {
  let inJamaat = 0;
  let total = 0;
  for (const d of days) {
    if (d > today) continue;
    for (const n of SALAH_NAMES) {
      const s = by?.get(d)?.entries?.[n];
      if (!s && d === today) continue;
      if (!s && !unloggedIsMissed(d, today)) continue;
      total++;
      if (s === 'takbir' || s === 'jamaat') inJamaat++;
    }
  }
  return { inJamaat, total };
}

/**
 * The weekend salah representative's sheet: everyone in their class, Saturday and Sunday, five
 * marks a day, laid out like the teacher's weekly register so it can be screenshotted and sent on.
 */
export function WeekendSalah() {
  const { today } = useActiveSession();
  const repOf = useRepClasses();
  const [sp, setSp] = useSearchParams();
  const cls = repOf.data.find((c) => c.id === sp.get('class')) ?? repOf.data[0] ?? null;
  const latest = weekendOf(today)[0];
  const p = sp.get('sat');
  const sat = p && isValidYmd(p) && p <= today ? weekendOf(p)[0] : latest;
  const days = [sat, addDays(sat, 1)];
  const roster = useDocData<ClassRoster>(cls ? rosterRef(cls.id) : null, `roster:${cls?.id ?? ''}`);
  const names = roster.data?.names ?? {};
  const people = Object.entries(names)
    .map(([uid, name]) => ({ uid, name: name || 'Unnamed student' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sheet = useWeekendSalah(
    people.map((x) => x.uid),
    days,
  );

  if (repOf.loading && !cls) return <Spinner />;
  if (!cls) return <Navigate to="/salah" replace />;

  const go = (d: string) => setSp({ class: cls.id, ...(d === latest ? {} : { sat: d }) }, { replace: true });
  const ready = !roster.loading && sheet.arrived + sheet.failed >= people.length * 2;
  const hijri = [formatHijri(days[0]), formatHijri(days[1])];
  const hijriLine = hijri[0] && hijri[1] ? `${hijri[0]} – ${hijri[1]}` : '';
  let classIn = 0;
  let classTotal = 0;
  let classMissed = 0;
  for (const x of people) {
    const c = counted(sheet.salah.get(x.uid), days, today);
    classIn += c.inJamaat;
    classTotal += c.total;
    classMissed += missedCount(sheet.salah.get(x.uid), days, today);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/salah" className="link -mb-1 inline-flex items-center gap-1 self-start">
        <IconChevronLeft size={16} /> Salah
      </Link>

      {repOf.data.length > 1 && (
        <select
          className="input"
          aria-label="Class"
          value={cls.id}
          onChange={(e) => setSp({ class: e.target.value, ...(sat === latest ? {} : { sat }) }, { replace: true })}
        >
          {repOf.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Previous weekend" onClick={() => go(addDays(sat, -7))}>
          <IconChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center text-sm text-slate-700">
          {sat === latest ? (today <= days[1] ? 'This weekend' : 'Last weekend') : `${formatGregorian(days[0], { weekday: undefined, year: undefined })} – ${formatGregorian(days[1], { weekday: undefined })}`}
        </div>
        <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Next weekend" disabled={sat >= latest} onClick={() => go(addDays(sat, 7))}>
          <IconChevronRight size={20} />
        </button>
      </div>

      {/* The part to screenshot: everything needed to read it is inside this card. */}
      <section className="flex flex-col gap-3 rounded-xl bg-surface p-4" aria-labelledby="weekend-sheet-title">
        <header>
          <p className="text-[11px] font-medium tracking-[0.08em] text-slate-500 uppercase">Weekend salah</p>
          <h1 id="weekend-sheet-title" className="font-serif text-[28px] leading-[1.15] text-slate-900" dir="auto">
            {cls.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Saturday and Sunday · {formatGregorian(days[0], { weekday: undefined, year: undefined })} – {formatGregorian(days[1], { weekday: undefined })}
          </p>
          {hijriLine && <p className="text-xs text-slate-500">{hijriLine}</p>}
        </header>

        {!ready ? (
          <Spinner />
        ) : people.length === 0 ? (
          <p className="text-sm text-slate-600">No students on this class's list yet. Ask your teacher to open the class once.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-100 px-2 py-2">
                <dt className="text-[11px] text-slate-500">In jamaat</dt>
                <dd className="num font-serif text-[24px] leading-tight text-slate-900">{classTotal ? `${Math.round((classIn / classTotal) * 100)}%` : '–'}</dd>
              </div>
              <div className="rounded-lg bg-slate-100 px-2 py-2">
                <dt className="text-[11px] text-slate-500">Salah missed</dt>
                <dd className={`num font-serif text-[24px] leading-tight ${classMissed ? 'text-red-800' : 'text-slate-900'}`}>{classMissed}</dd>
              </div>
              <div className="rounded-lg bg-slate-100 px-2 py-2">
                <dt className="text-[11px] text-slate-500">Students</dt>
                <dd className="num font-serif text-[24px] leading-tight text-slate-900">{people.length}</dd>
              </div>
            </dl>

            <table className="w-full table-fixed border-separate border-spacing-x-[3px] border-spacing-y-[3px]">
              <caption className="sr-only">
                Salah per student on {formatGregorian(days[0])} and {formatGregorian(days[1])}: Fajr, Dhuhr, Asr, Maghrib and Isha each day, then salah in jamaat
              </caption>
              <colgroup>
                <col className="w-[34%]" />
                {days.map((d) => (
                  <Fragment key={d}>
                    {SALAH_NAMES.map((n) => (
                      <col key={n} />
                    ))}
                    <col className="w-[6px]" />
                  </Fragment>
                ))}
                <col className="w-[2.75rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" />
                  {days.map((d) => (
                    <Fragment key={d}>
                      <th scope="colgroup" colSpan={5} className={`text-[11px] font-medium ${d === today ? 'text-brand-700' : 'text-slate-600'}`}>
                        {formatGregorian(d, { weekday: 'short', month: undefined, year: undefined })}
                      </th>
                      <th aria-hidden />
                    </Fragment>
                  ))}
                  <th scope="col" className="text-right text-[10px] leading-tight font-medium text-slate-500">
                    Jamaat
                  </th>
                </tr>
                <tr aria-hidden>
                  <th />
                  {days.map((d) => (
                    <Fragment key={d}>
                      {LETTER.map((l, i) => (
                        <th key={i} className="text-[9px] leading-none font-normal text-slate-400">
                          {l}
                        </th>
                      ))}
                      <th />
                    </Fragment>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {people.map((x) => {
                  const by = sheet.salah.get(x.uid);
                  const c = counted(by, days, today);
                  return (
                    <tr key={x.uid}>
                      <th scope="row" className="truncate pr-1 text-left text-[13px] font-normal text-slate-800" dir="auto" title={x.name}>
                        {x.name}
                      </th>
                      {days.map((d) => {
                        const future = d > today;
                        return (
                          <Fragment key={d}>
                            {SALAH_NAMES.map((n) => {
                              const s = by?.get(d)?.entries?.[n];
                              const desc = future ? 'not yet' : s ? STATUS_DESC[adminStatus(s)!] : unloggedIsMissed(d, today) ? 'missed (not logged)' : 'not logged';
                              return (
                                <td key={n} className="p-0">
                                  <span className={`block h-6 rounded-[2px] ${future ? 'bg-slate-100' : bar(s, false, unloggedIsMissed(d, today))}`} title={`${SALAH_LABEL[n]}: ${desc}`}>
                                    <span className="sr-only">
                                      {SALAH_LABEL[n]}: {desc}
                                    </span>
                                  </span>
                                </td>
                              );
                            })}
                            <td aria-hidden />
                          </Fragment>
                        );
                      })}
                      <td className="num text-right text-[13px] text-slate-700">
                        {c.inJamaat}/{c.total || '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500" aria-hidden>
              <span>F D A M I = Fajr, Dhuhr, Asr, Maghrib, Isha</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-green-600" /> Jamaat</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-red-400" /> Missed, qadha or not logged</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[6px] rounded-[1.5px] bg-slate-200" /> Not logged yet</span>
            </div>
          </>
        )}
      </section>

      {sheet.failed > 0 && <Notice tone="warn">Some students’ salah couldn’t load. Check your connection, or ask your teacher whether the class list is up to date.</Notice>}
    </div>
  );
}
