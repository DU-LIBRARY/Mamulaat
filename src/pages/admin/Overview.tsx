import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange } from '../../hooks/useAdminData';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Spinner, StatCard, cellClass } from '../../components/ui';
import { addDays, weekDays, weekStartOf } from '../../lib/dates';
import { needsAttention, studentWeek } from '../../lib/reports';
import { pct } from '../../lib/scoring';

export function Overview() {
  const { today, settings } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const students = users.data.filter((u) => u.role === 'student' && u.status === 'active');
  const pending = users.data.filter((u) => u.status === 'pending');
  const days = weekDays(weekStartOf(today, settings.weekStart));
  const from = [days[0], addDays(today, -(settings.attentionNoLogDays - 1))].sort()[0];
  const range = useStudentsRange(students.map((s) => s.id), from, today);

  const { attention, byClass, loggedToday } = useMemo(() => {
    const attention = [];
    const byClass = new Map<string, number[]>();
    let loggedToday = 0;
    for (const s of students) {
      const r = range.get(s.id);
      if (!r?.loaded) continue;
      const a = needsAttention(s, days, r.mamoolaat, r.logs, today, settings.attentionThreshold, settings.attentionNoLogDays);
      if (a) attention.push(a);
      const w = studentWeek(s, days, r.mamoolaat, r.logs, today);
      if (w.days.find((d) => d.day === today)?.hasLog) loggedToday++;
      if (w.completion != null) {
        const k = s.classId ?? '';
        byClass.set(k, [...(byClass.get(k) ?? []), w.completion]);
      }
    }
    return { attention, byClass, loggedToday };
  }, [students, range, days.join(), today, settings]);

  if (users.loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      <DateLine day={today} />
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="👥" label="Students" value={students.length} />
        <StatCard icon="✅" label="Logged today" value={`${loggedToday}/${students.length}`} />
        <StatCard icon="⏳" label="Pending" value={pending.length} />
      </div>

      {pending.length > 0 && (
        <Link to="/admin/students" className="card flex items-center justify-between ring-2 ring-gold-400/60">
          <span>
            <b>{pending.length}</b> sign-up{pending.length > 1 ? 's' : ''} waiting for approval
          </span>
          <span className="font-semibold text-brand-700">Review →</span>
        </Link>
      )}

      <section>
        <div className="section-title">
          Needs attention <span className="font-normal normal-case">(below {settings.attentionThreshold}% this week or no logs for {settings.attentionNoLogDays} days)</span>
        </div>
        {attention.length === 0 ? (
          <EmptyState>Everyone is on track. 🎉</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li key={a.student.id}>
                <Link to={`/admin/student/${a.student.id}`} className="card flex items-center gap-3 p-3">
                  <span className={`chip min-w-12 justify-center py-1 text-sm ${cellClass(a.completion)}`}>{pct(a.completion)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" dir="auto">
                      {a.student.name ?? a.student.email}
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
        <div className="section-title">Classes this week</div>
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
