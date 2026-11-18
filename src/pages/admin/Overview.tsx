import { Link } from 'react-router-dom';
import { Fragment, useMemo } from 'react';
import type { UserProfile } from '../../types';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange, useStudentsSalah } from '../../hooks/useAdminData';
import { SalahRegister } from '../../components/SalahRegister';
import { DateLine } from '../../components/DateLine';
import { ExportBar } from '../../components/ExportBar';
import { EmptyState, Spinner, Stat, StatRow, cellClass } from '../../components/ui';
import { IconCheck } from '../../components/icons';
import { dayNumber, formatGregorian, formatMonth, monthDays, shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { fetchStudentsRange } from '../../lib/db';
import { downloadCsv } from '../../lib/csv';
import { registerRows } from '../../lib/exports';
import { useApproveAll } from './Students';
import { studentWeek, type StudentWeek } from '../../lib/reports';
import { pct } from '../../lib/scoring';
import { displayName } from '../../lib/display';

export function Overview() {
  const { today, settings } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const approveAll = useApproveAll();
  const students = users.data.filter((u) => u.role === 'student' && u.status === 'active');
  const pending = users.data.filter((u) => u.status === 'pending');
  const days = weekDays(weekStartOf(today, settings.weekStart));
  const range = useStudentsRange(students.map((s) => s.id), days[0], today);
  const salah = useStudentsSalah(students.map((s) => s.id), days[0], days[6]);

  const { byClass, loggedToday, weeks } = useMemo(() => {
    const weeks = new Map<string, StudentWeek>();
    const byClass = new Map<string, number[]>();
    let loggedToday = 0;
    for (const s of students) {
      const r = range.get(s.id);
      if (!r?.loaded) continue;
      const w = studentWeek(s, days, r.mamoolaat, r.logs, today);
      weeks.set(s.id, w);
      const t = w.days.find((d) => d.day === today);
      if (t?.hasLog) loggedToday++;
      if (w.completion != null) {
        const k = s.classId ?? '';
        byClass.set(k, [...(byClass.get(k) ?? []), w.completion]);
      }
    }
    return { byClass, loggedToday, weeks };
  }, [students, range, days.join(), today]);

  if (users.loading) return <Spinner />;

  const className = (s: UserProfile) => classes.data.find((c) => c.id === s.classId)?.name ?? 'No class';
  // Same order as the register: class order, then name.
  const ordered = [
    ...classes.data.flatMap((c) => students.filter((s) => s.classId === c.id)),
    ...students.filter((s) => !s.classId || !classes.data.some((c) => c.id === s.classId)),
  ];
  const readyToApprove = pending.filter((u) => u.signupComplete && classes.data.some((c) => c.id === u.requestedClassId));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="print-only text-xl font-semibold">Mamūlāt — madrassah register</h1>
      <DateLine day={today} size="lg" />
      <StatRow>
        <Stat label="Students" value={students.length} />
        <Stat label="Logged today" value={`${loggedToday}/${students.length}`} />
        <Stat label="Pending" value={pending.length} />
      </StatRow>

      {pending.length > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-400/50 bg-gold-50 px-4 py-3 text-gold-900">
          <Link to="/admin/students" className="underline decoration-gold-400 underline-offset-4">
            <b className="font-semibold">{pending.length}</b> sign-up{pending.length > 1 ? 's' : ''} waiting for approval
          </Link>
          {readyToApprove.length > 0 && (
            <button className="btn min-h-11 border border-gold-400 bg-surface px-3 text-sm text-gold-900 hover:bg-gold-50" onClick={() => approveAll(readyToApprove)}>
              <IconCheck size={16} />
              Approve {readyToApprove.length === pending.length ? 'all' : readyToApprove.length} into requested class{readyToApprove.length > 1 ? 'es' : ''}
            </button>
          )}
        </div>
      )}

      {students.length > 0 && (
        <section>
          <h2 className="section-title mb-2">
            Salah register <span className="font-normal normal-case">({formatGregorian(days[0])} – {formatGregorian(days[6])})</span>
          </h2>
          <div className="rounded-xl bg-surface px-1.5 py-2">
            <SalahRegister
              days={days}
              today={today}
              salah={salah}
              groups={[
                ...classes.data.map((c) => ({ key: c.id, label: c.name, students: students.filter((s) => s.classId === c.id) })),
                { key: '', label: 'No class', students: students.filter((s) => !s.classId || !classes.data.some((c) => c.id === s.classId)) },
              ].filter((g) => g.students.length > 0)}
            />
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title mb-0">
            Madrassah register <span className="font-normal normal-case">({formatGregorian(days[0])} – {formatGregorian(days[6])})</span>
          </h2>
          {students.length > 0 && (
            <ExportBar
              week={() =>
                downloadCsv(
                  `mamulaat-register-${days[0]}.csv`,
                  registerRows(ordered, new Map(ordered.map((s) => [s.id, range.get(s.id) ?? { mamoolaat: [], logs: new Map() }])), days, today, className),
                )
              }
              monthLabel={formatMonth(today)}
              month={async () => {
                const md = monthDays(today);
                const data = await fetchStudentsRange(ordered.map((s) => s.id), md[0], md[md.length - 1]);
                downloadCsv(`mamulaat-register-${today.slice(0, 7)}.csv`, registerRows(ordered, data, md, today, className));
              }}
            />
          )}
        </div>
        {students.length === 0 ? (
          <EmptyState>No active students yet.</EmptyState>
        ) : (
          <Register
            days={days}
            today={today}
            groups={[
              ...classes.data.map((c) => ({ id: c.id, name: c.name, students: students.filter((s) => s.classId === c.id) })),
              { id: '', name: 'No class', students: students.filter((s) => !s.classId || !classes.data.some((c) => c.id === s.classId)) },
            ].filter((g) => g.students.length > 0)}
            weeks={weeks}
          />
        )}
        <p className="mt-2 text-xs text-slate-500">✓ every mamool completed · number = % completed · ✕ nothing logged · · today, not logged yet · – no mamoolaat set. Tap a student for details.</p>
      </section>

      <section className="no-print">
        <h2 className="section-title">Classes this week</h2>
        {classes.data.length === 0 ? (
          <EmptyState>
            No classes yet. <Link className="font-semibold text-brand-700 underline" to="/admin/classes">Create one</Link>.
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {classes.data.map((c) => {
              const vals = byClass.get(c.id) ?? [];
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
              const n = students.filter((s) => s.classId === c.id).length;
              return (
                <li key={c.id}>
                  <Link to={`/admin/class/${c.id}?view=week`} className="card flex items-center justify-between p-3">
                    <span>
                      <span className="block font-semibold" dir="auto">
                        {c.name}
                      </span>
                      <span className="text-sm text-slate-500">
                        {n} student{n === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className={`chip px-3 py-1 text-sm ${cellClass(avg)}`}>{pct(avg)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

interface RegisterGroup {
  id: string;
  name: string;
  students: UserProfile[];
}

/** Whole-madrassah weekly register: classes in order, each student's daily completion. */
function Register({ days, today, groups, weeks }: { days: string[]; today: string; groups: RegisterGroup[]; weeks: Map<string, StudentWeek> }) {
  const cols = days.length + 3;
  return (
    <div className="num overflow-x-auto rounded-xl bg-surface p-2">
      <table className="w-full border-separate border-spacing-0.5 text-center text-[11px]">
        <caption className="sr-only">Each student's completion per day this week, grouped by class</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface text-left font-semibold text-slate-500">Student</th>
            {days.map((d) => (
              <th scope="col" key={d} className={`min-w-8 font-semibold ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                <div>{shortDay(d)}</div>
                <div className="text-sm">{dayNumber(d)}</div>
              </th>
            ))}
            <th scope="col" className="min-w-10 font-semibold text-slate-700">Full</th>
            <th scope="col" className="min-w-12 font-semibold text-slate-700">Week</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.id || 'none'}>
              <tr>
                <th colSpan={cols} scope="colgroup" className="bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold text-slate-700" dir="auto">
                  {g.id ? (
                    <Link to={`/admin/class/${g.id}?view=week`} className="hover:underline">
                      {g.name}
                    </Link>
                  ) : (
                    g.name
                  )}{' '}
                  <span className="font-normal text-slate-500 normal-case">· {g.students.length}</span>
                </th>
              </tr>
              {g.students.map((s) => {
                const w = weeks.get(s.id);
                const elapsed = days.filter((d) => {
                  const x = w?.days.find((y) => y.day === d);
                  return d <= today && x?.completion != null && !(d === today && !x.hasLog);
                }).length;
                return (
                  <tr key={s.id}>
                    <th scope="row" className="sticky left-0 z-10 max-w-32 truncate bg-surface pr-2 text-left text-sm font-medium" dir="auto">
                      <Link to={`/admin/student/${s.id}?date=${days[0]}`} className="text-brand-700 underline-offset-2 hover:underline">
                        {displayName(s)}
                      </Link>
                    </th>
                    {days.map((d, i) => {
                      if (d > today) return <td key={d} className="h-9" />;
                      if (!w) return <td key={d} className="h-9 rounded-md bg-slate-50 text-slate-300">…</td>;
                      const day = w.days[i];
                      const c = day.completion;
                      const notYet = d === today && c != null && !day.hasLog;
                      const label = c == null ? '–' : notYet ? '·' : c >= 1 ? '✓' : !day.hasLog ? '✕' : Math.round(c * 100);
                      const spoken = c == null ? 'no mamoolaat' : notYet ? 'not logged yet' : c >= 1 ? 'all done' : !day.hasLog ? 'nothing logged' : `${Math.round(c * 100)}%`;
                      return (
                        <td key={d} className={`h-9 rounded-md font-semibold ${cellClass(notYet ? null : c)}`} title={spoken}>
                          <span aria-hidden>{label}</span>
                          <span className="sr-only">{spoken}</span>
                        </td>
                      );
                    })}
                    <td className="font-semibold text-slate-700">{w ? `${w.fullDays}/${elapsed}` : ''}</td>
                    <td className={`rounded font-semibold ${cellClass(w?.completion)}`}>{w ? pct(w.completion) : ''}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
