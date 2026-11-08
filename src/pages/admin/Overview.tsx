import { Link } from 'react-router-dom';
import { Fragment, useMemo, useState } from 'react';
import { query, where } from 'firebase/firestore';
import type { Nudge, UserProfile } from '../../types';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange } from '../../hooks/useAdminData';
import { useCollectionData } from '../../hooks/useFirestore';
import { DateLine } from '../../components/DateLine';
import { ExportBar } from '../../components/ExportBar';
import { useDialog } from '../../components/Dialog';
import { EmptyState, Spinner, Stat, StatRow, cellClass } from '../../components/ui';
import { IconBell, IconCheck } from '../../components/icons';
import { addDays, dayNumber, formatGregorian, formatMonth, monthDays, shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { fetchStudentsRange, nudgesCol, sendNudges } from '../../lib/db';
import { downloadCsv } from '../../lib/csv';
import { registerRows } from '../../lib/exports';
import { useApproveAll } from './Students';
import { needsAttention, studentWeek, type StudentWeek } from '../../lib/reports';
import { pct } from '../../lib/scoring';
import { displayName } from '../../lib/display';

export function Overview() {
  const { today, settings, actor } = useActiveSession();
  const { notify } = useDialog();
  const users = useAllUsers();
  const classes = useClasses();
  const nudges = useCollectionData<Nudge>(query(nudgesCol(), where('day', '==', today)), `nudges:${today}`);
  const nudged = new Set(nudges.data.map((n) => n.uid));
  const [nudging, setNudging] = useState(false);
  const approveAll = useApproveAll();
  const students = users.data.filter((u) => u.role === 'student' && u.status === 'active');
  const pending = users.data.filter((u) => u.status === 'pending');
  const days = weekDays(weekStartOf(today, settings.weekStart));
  const from = [days[0], addDays(today, -(settings.attentionNoLogDays - 1))].sort()[0];
  const range = useStudentsRange(students.map((s) => s.id), from, today);

  const { attention, byClass, loggedToday, weeks, notLogged } = useMemo(() => {
    const attention = [];
    const notLogged: UserProfile[] = [];
    const weeks = new Map<string, StudentWeek>();
    const byClass = new Map<string, number[]>();
    let loggedToday = 0;
    for (const s of students) {
      const r = range.get(s.id);
      if (!r?.loaded) continue;
      const a = needsAttention(s, days, r.mamoolaat, r.logs, today, settings.attentionThreshold, settings.attentionNoLogDays);
      if (a) attention.push(a);
      const w = studentWeek(s, days, r.mamoolaat, r.logs, today);
      weeks.set(s.id, w);
      const t = w.days.find((d) => d.day === today);
      if (t?.hasLog) loggedToday++;
      else if (t?.completion != null) notLogged.push(s); // has mamoolaat today, nothing logged yet
      if (w.completion != null) {
        const k = s.classId ?? '';
        byClass.set(k, [...(byClass.get(k) ?? []), w.completion]);
      }
    }
    return { attention, byClass, loggedToday, weeks, notLogged };
  }, [students, range, days.join(), today, settings]);

  if (users.loading) return <Spinner />;

  const className = (s: UserProfile) => classes.data.find((c) => c.id === s.classId)?.name ?? 'No class';
  // Same order as the register: class order, then name.
  const ordered = [
    ...classes.data.flatMap((c) => students.filter((s) => s.classId === c.id)),
    ...students.filter((s) => !s.classId || !classes.data.some((c) => c.id === s.classId)),
  ];
  const toNudge = notLogged.filter((s) => !nudged.has(s.id));
  const nudge = async (list: UserProfile[]) => {
    if (!list.length) return;
    setNudging(true);
    try {
      await sendNudges(list.map((s) => s.id), today, actor);
    } catch (e) {
      await notify('Could not send the reminder', (e as Error).message);
    } finally {
      setNudging(false);
    }
  };
  const readyToApprove = pending.filter((u) => u.signupComplete && classes.data.some((c) => c.id === u.requestedClassId));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="print-only text-xl font-semibold">Mamulaat — madrassah register</h1>
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
            <button className="btn min-h-9 border border-gold-400 bg-surface px-3 text-sm text-gold-900 hover:bg-gold-50" onClick={() => approveAll(readyToApprove)}>
              <IconCheck size={16} />
              Approve {readyToApprove.length === pending.length ? 'all' : readyToApprove.length} into requested class{readyToApprove.length > 1 ? 'es' : ''}
            </button>
          )}
        </div>
      )}

      <section className="no-print" aria-labelledby="not-logged">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="not-logged" className="section-title mb-0">
            Not logged today <span className="font-normal text-slate-500">({notLogged.length})</span>
          </h2>
          {toNudge.length > 1 && (
            <button className="btn-secondary min-h-9 px-3 text-sm" disabled={nudging} onClick={() => nudge(toNudge)}>
              <IconBell size={16} />
              Remind all {toNudge.length}
            </button>
          )}
        </div>
        {notLogged.length === 0 ? (
          <EmptyState>{students.length ? 'Everyone has logged something today.' : 'No active students yet.'}</EmptyState>
        ) : (
          <ul className="sheet">
            {notLogged.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <Link to={`/admin/student/${s.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900" dir="auto">
                    {displayName(s)}
                  </span>
                  <span className="block truncate text-xs text-slate-500" dir="auto">
                    {className(s)}
                    {s.reminderEnabled ? '' : ' · reminders off on their device'}
                  </span>
                </Link>
                {nudged.has(s.id) ? (
                  <span className="inline-flex min-h-9 items-center gap-1 text-sm text-brand-700">
                    <IconCheck size={16} /> Reminded
                  </span>
                ) : (
                  <button className="btn-secondary min-h-9 px-3 text-sm" disabled={nudging} onClick={() => nudge([s])} aria-label={`Send ${displayName(s)} a reminder`}>
                    <IconBell size={16} />
                    Remind
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Remind sends a notification to the student's phone now (if they turned notifications on) and shows a note when they open the app. Once a day per student.</p>
      </section>

      <section className="no-print">
        <h2 className="section-title">
          Needs attention <span className="block text-xs font-normal text-slate-500">Below {settings.attentionThreshold}% this week or no logs for {settings.attentionNoLogDays} days</span>
        </h2>
        {attention.length === 0 ? (
          <EmptyState>Everyone is on track.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li key={a.student.id}>
                <Link to={`/admin/student/${a.student.id}`} className="card flex items-center gap-3 p-3">
                  <span className={`chip min-w-12 justify-center py-1 text-sm ${cellClass(a.completion)}`}>{pct(a.completion)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" dir="auto">
                      {displayName(a.student)}
                    </span>
                    <span className="block text-sm text-slate-500">
                      {classes.data.find((c) => c.id === a.student.classId)?.name ?? 'No class'} · {a.reasons.join(' · ')}
                    </span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
        <p className="mt-2 text-xs text-slate-500">✓ every mamool completed · number = % completed · ✕ nothing logged · – no mamoolaat set. Tap a student for details.</p>
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
    <div className="num overflow-x-auto rounded-lg border border-slate-200 bg-surface p-2">
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
                const elapsed = days.filter((d) => d <= today && w?.days.find((x) => x.day === d)?.completion != null).length;
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
                      const label = c == null ? '–' : c >= 1 ? '✓' : !day.hasLog ? '✕' : Math.round(c * 100);
                      const spoken = c == null ? 'no mamoolaat' : c >= 1 ? 'all done' : !day.hasLog ? 'nothing logged' : `${Math.round(c * 100)}%`;
                      return (
                        <td key={d} className={`h-9 rounded-md font-semibold ${cellClass(c)}`} title={spoken}>
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
