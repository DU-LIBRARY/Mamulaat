import { useState } from 'react';
import { Link } from 'react-router-dom';
import { query, where } from 'firebase/firestore';
import type { Nudge, UserProfile } from '../../types';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { useCollectionData } from '../../hooks/useFirestore';
import { DateLine } from '../../components/DateLine';
import { useDialog } from '../../components/Dialog';
import { EmptyState, Spinner } from '../../components/ui';
import { IconBell, IconCheck } from '../../components/icons';
import { nudgesCol, sendNudges } from '../../lib/db';
import { displayName } from '../../lib/display';

/**
 * "Please log today" reminders, for a limited admin. They can't see anyone's logs, so every
 * active student is listed; the push itself is only sent to a student who hasn't logged yet.
 */
export function Remind() {
  const { today, actor } = useActiveSession();
  const { notify } = useDialog();
  const users = useAllUsers();
  const classes = useClasses();
  const nudges = useCollectionData<Nudge>(query(nudgesCol(), where('day', '==', today)), `nudges:${today}`);
  const nudged = new Set(nudges.data.map((n) => n.uid));
  const [busy, setBusy] = useState(false);

  if (users.loading || classes.loading) return <Spinner />;
  const students = users.data.filter((u) => u.role === 'student' && u.status === 'active');
  const groups = [
    ...classes.data.map((c) => ({ key: c.id, name: c.name, students: students.filter((s) => s.classId === c.id) })),
    { key: '', name: 'No class', students: students.filter((s) => !s.classId || !classes.data.some((c) => c.id === s.classId)) },
  ].filter((g) => g.students.length > 0);

  const nudge = async (list: UserProfile[]) => {
    const todo = list.filter((s) => !nudged.has(s.id));
    if (!todo.length) return;
    setBusy(true);
    try {
      await sendNudges(todo.map((s) => s.id), today, actor);
    } catch (e) {
      await notify('Could not send the reminder', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const left = (list: UserProfile[]) => list.filter((s) => !nudged.has(s.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <DateLine day={today} size="lg" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="section-title mb-0">Remind students</h1>
        {left(students) > 1 && (
          <button className="btn-secondary min-h-11 px-3 text-sm" disabled={busy} onClick={() => nudge(students)}>
            <IconBell size={16} />
            Remind all {left(students)}
          </button>
        )}
      </div>
      {groups.length === 0 && <EmptyState>No active students yet.</EmptyState>}
      {groups.map((g) => (
        <section key={g.key || 'none'} aria-label={g.name}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="section-title mb-0" dir="auto">
              {g.name} <span className="font-normal text-slate-500">({g.students.length})</span>
            </h2>
            {left(g.students) > 1 && (
              <button className="btn-ghost min-h-11 px-3 text-sm" disabled={busy} onClick={() => nudge(g.students)}>
                Remind class
              </button>
            )}
          </div>
          <ul className="sheet">
            {g.students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <Link to={`/admin/student/${s.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900" dir="auto">
                    {displayName(s)}
                  </span>
                  {!s.reminderEnabled && <span className="block truncate text-xs text-slate-500">Reminders off on their device</span>}
                </Link>
                {nudged.has(s.id) ? (
                  <span className="inline-flex min-h-11 items-center gap-1 text-sm text-brand-700">
                    <IconCheck size={16} /> Reminded
                  </span>
                ) : (
                  <button className="btn-secondary min-h-11 px-3 text-sm" disabled={busy} onClick={() => nudge([s])} aria-label={`Send ${displayName(s)} a reminder`}>
                    <IconBell size={16} />
                    Remind
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-slate-500">
        Remind sends a notification to the student's phone (if they turned notifications on) and shows a note when they open the app. The phone notification is only sent if they
        haven't logged anything yet today. Once a day per student.
      </p>
    </div>
  );
}
