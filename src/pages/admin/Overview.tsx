import { Link } from 'react-router-dom';
import { Fragment, useMemo } from 'react';
import type { UserProfile } from '../../types';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange } from '../../hooks/useAdminData';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Spinner, Stat, StatRow, cellClass } from '../../components/ui';
import { addDays, dayNumber, formatGregorian, shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { needsAttention, studentWeek, type StudentWeek } from '../../lib/reports';
import { pct } from '../../lib/scoring';
import { displayName } from '../../lib/display';

export function Overview() {
  const { today, settings } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const students = users.data.filter((u) => u.role === 'student' && u.status === 'active');
  const pending = users.data.filter((u) => u.status === 'pending');
  const days = weekDays(weekStartOf(today, settings.weekStart));
  const from = [days[0], addDays(today, -(settings.attentionNoLogDays - 1))].sort()[0];
  const range = useStudentsRange(students.map((s) => s.id), from, today);

  const { attention, byClass, loggedToday, weeks } = useMemo(() => {
    const attention = [];
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
      if (w.days.find((d) => d.day === today)?.hasLog) loggedToday++;
      if (w.completion != null) {
        const k = s.classId ?? '';
        byClass.set(k, [...(byClass.get(k) ?? []), w.completion]);
      }
    }
    return { attention, byClass, loggedToday, weeks };
  }, [students, range, days.join(), today, settings]);

  if (users.loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      <DateLine day={today} size="lg" />
      <StatRow>
        <Stat label="Students" value={students.length} />
        <Stat label="Logged today" value={`${loggedToday}/${students.length}`} />
        <Stat label="Pending" value={pending.length} />
      </StatRow>

      {pending.length > 0 && (
        <Link to="/admin/students" className="flex items-center justify-between rounded-lg border border-gold-400/50 bg-[#fbf6e9] px-4 py-3 text-[#5b4512]">
          <span>
            <b className="font-semibold">{pending.length}</b> sign-up{pending.length > 1 ? 's' : ''} waiting for approval
          </span>
          <span className="text-sm font-medium underline decoration-gold-400 underline-offset-4">Review</span>
        </Link>
      )}

      <section>
        <div className="section-title">
          Needs attention <span className="block text-xs font-normal text-slate-500">Below {settings.attentionThreshold}% this week or no logs for {settings.attentionNoLogDays} days</span>
        </div>
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
        <div className="section-title">
          Madrassah register <span className="font-normal normal-case">({formatGregorian(days[0])} – {formatGregorian(days[6])})</span>
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

      <section>
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
    <div className="num overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
      <table className="w-full border-separate border-spacing-0.5 text-center text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white text-left font-semibold text-slate-500">Student</th>
            {days.map((d) => (
              <th key={d} className={`min-w-8 font-semibold ${d === today ? 'text-brand-700' : 'text-slate-500'}`}>
                <div>{shortDay(d)}</div>
                <div className="text-sm">{dayNumber(d)}</div>
              </th>
            ))}
            <th className="min-w-10 font-semibold text-slate-700">Full</th>
            <th className="min-w-12 font-semibold text-slate-700">Week</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.id || 'none'}>
              <tr>
                <th colSpan={cols} className="bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold text-slate-700" dir="auto">
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
                    <th className="sticky left-0 z-10 max-w-32 truncate bg-white pr-2 text-left text-sm font-medium" dir="auto">
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
                      return (
                        <td key={d} className={`h-9 rounded-md font-semibold ${cellClass(c)}`} title={c == null ? 'No mamoolaat' : `${Math.round(c * 100)}%`}>
                          {label}
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
