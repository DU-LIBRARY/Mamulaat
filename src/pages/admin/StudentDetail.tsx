import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { useStudentLive } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { MamoolEditor } from '../../components/MamoolEditor';
import { EmptyState, Spinner, StatCard } from '../../components/ui';
import { addComment, deleteComment, moveUser } from '../../lib/db';
import { addDays, formatGregorian, isValidYmd, weekDays, weekStartOf } from '../../lib/dates';
import { studentWeek } from '../../lib/reports';
import { bestStreak, currentStreak, pct } from '../../lib/scoring';
import { ClassSelect, confirmDelete } from './Students';
import { describeChange } from '../student/Messages';

function when(ts?: { toDate(): Date } | null) {
  return ts ? ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'pending sync';
}

export function StudentDetail() {
  const { uid = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { today, settings, actor } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const data = useStudentLive(uid);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'week' | 'mamoolaat' | 'comments'>('week');
  const student = users.data.find((u) => u.id === uid);
  const d = sp.get('date');
  const anchor = d && isValidYmd(d) && d <= today ? d : today;
  const days = weekDays(weekStartOf(anchor, settings.weekStart));

  const week = useMemo(() => (student ? studentWeek(student, days, data.all, data.logs, today) : null), [student, days.join(), data.all, data.logs, today]);

  if (users.loading) return <Spinner />;
  if (!student) return <EmptyState>Student not found.</EmptyState>;

  const rows: GridRow[] = week
    ? [
        ...week.perMamool.map((pm) => ({ key: pm.mamool.id, label: pm.mamool.name, cells: pm.cells, total: pm.completion })),
        { key: '__all', label: <b>All</b>, cells: week.days.map((x) => x.completion), total: week.completion },
      ]
    : [];
  const setAnchor = (v: string) => {
    const n = new URLSearchParams(sp);
    n.set('date', v);
    setSp(n, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {student.photoURL && <img src={student.photoURL} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold" dir="auto">
              {student.name ?? student.email}
            </div>
            <div className="truncate text-sm text-slate-500">
              {student.email} · {student.status}
            </div>
          </div>
        </div>
        <ClassSelect classes={classes.data} value={student.classId ?? ''} onChange={(v) => v && moveUser(student.id, v, actor)} placeholder="No class" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="🔥" label="Streak" value={currentStreak(today, data.logs, data.all)} sub={`Best ${bestStreak(today, data.logs, data.all)}`} />
        <StatCard icon="📅" label="Week" value={pct(week?.completion)} sub={`${week?.fullDays ?? 0} full days`} />
        <StatCard icon="✅" label="Logged" value={[...data.logs.keys()].filter((d) => d <= today).length} sub="days in total" />
      </div>

      <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
        {(
          [
            ['week', 'Weekly'],
            ['mamoolaat', 'Mamoolaat'],
            ['comments', `Comments (${data.comments.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`btn min-h-10 flex-1 px-2 text-sm ${tab === k ? 'bg-brand-700 text-white' : 'text-slate-600'}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'week' && (
        <>
          <div className="flex items-center justify-between">
            <button className="btn-secondary px-3" onClick={() => setAnchor(addDays(days[0], -7))}>
              ←
            </button>
            <div className="text-sm font-semibold">
              {formatGregorian(days[0], { year: undefined })} – {formatGregorian(days[6])}
            </div>
            <button className="btn-secondary px-3" disabled={days[6] >= today} onClick={() => setAnchor([addDays(days[0], 7), today].sort()[0])}>
              →
            </button>
          </div>
          <div className="card p-2">{rows.length > 1 ? <WeekGrid days={days} rows={rows} today={today} firstHeader="Mamool" /> : <EmptyState>No mamoolaat this week.</EmptyState>}</div>
        </>
      )}

      {tab === 'mamoolaat' && (
        <>
          <p className="text-sm text-slate-500">Changes you make here are recorded (who/when) and shown to the student.</p>
          <MamoolEditor uid={uid} all={data.all} today={today} actor={actor} />
          {data.changes.length > 0 && (
            <section className="card">
              <div className="section-title">Change history</div>
              <ul className="flex flex-col gap-2 text-sm">
                {data.changes.map((c) => (
                  <li key={c.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <div dir="auto">{describeChange(c)}</div>
                    <div className="text-xs text-slate-500">
                      {c.actorName} · {when(c.createdAt)} · {c.seenAt ? 'seen by student' : 'not seen yet'}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'comments' && (
        <>
          <form
            className="card flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) addComment(uid, text, actor);
              setText('');
            }}
          >
            <label className="label">Leave a comment (shows on the student's home page)</label>
            <textarea className="input min-h-24" dir="auto" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
            <button className="btn-primary" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
          {data.comments.length === 0 ? (
            <EmptyState>No comments yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.comments.map((c) => (
                <li key={c.id} className="card p-3">
                  <p className="whitespace-pre-wrap" dir="auto">
                    {c.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {when(c.createdAt)} · {c.readAt ? `read ${when(c.readAt)}` : 'unread'}
                    </span>
                    <button className="btn-ghost min-h-8 px-2 text-xs text-red-600" onClick={() => confirm('Delete comment?') && deleteComment(uid, c.id, actor)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button className="btn-ghost mt-4 text-red-600" onClick={async () => (await confirmDelete(student, actor)) && nav('/admin/students')}>
        Delete student and all data…
      </button>
    </div>
  );
}
