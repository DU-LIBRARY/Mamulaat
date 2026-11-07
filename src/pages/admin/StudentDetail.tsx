import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { useStudentLive } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { MamoolEditor } from '../../components/MamoolEditor';
import { EmptyState, Spinner, StatCard } from '../../components/ui';
import { Checklist } from '../../components/Checklist';
import { DateLine } from '../../components/DateLine';
import { useDialog } from '../../components/Dialog';
import { addComment, adminDeleteLog, deactivateUser, deleteChange, deleteComment, moveUser, reactivateUser, rejectUser, renameUser, setPending } from '../../lib/db';
import { addDays, formatGregorian, isValidYmd, weekDays, weekStartOf } from '../../lib/dates';
import { studentWeek } from '../../lib/reports';
import { bestStreak, currentStreak, dayStats, pct, scheduledFor } from '../../lib/scoring';
import { ClassSelect, useDeleteUsers } from './Students';
import { describeChange } from '../student/Messages';
import { displayName } from '../../lib/display';

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
  const [tab, setTab] = useState<'week' | 'day' | 'mamoolaat' | 'comments' | 'profile'>(sp.get('tab') === 'day' ? 'day' : 'week');
  const { confirm, notify } = useDialog();
  const del = useDeleteUsers(actor);
  const student = users.data.find((u) => u.id === uid);
  const [nameDraft, setNameDraft] = useState('');
  useEffect(() => setNameDraft(student?.name ?? ''), [student?.name]);
  const [err, setErr] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.then(() => setErr(null)).catch((e) => setErr((e as Error).message));
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
              {displayName(student)}
            </div>
            <div className="truncate text-sm text-slate-500">
              {student.status}
            </div>
          </div>
        </div>
      </div>
      {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="🔥" label="Streak" value={currentStreak(today, data.logs, data.all)} sub={`Best ${bestStreak(today, data.logs, data.all)}`} />
        <StatCard icon="📅" label="Week" value={pct(week?.completion)} sub={`${week?.fullDays ?? 0} full days`} />
        <StatCard icon="✅" label="Logged" value={[...data.logs.keys()].filter((d) => d <= today).length} sub="days in total" />
      </div>

      <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
        {(
          [
            ['week', 'Weekly'],
            ['day', 'Day'],
            ['mamoolaat', 'Mamoolaat'],
            ['comments', `Notes (${data.comments.length})`],
            ['profile', 'Profile'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`btn min-h-11 flex-1 px-1 text-xs sm:text-sm ${tab === k ? 'bg-brand-700 text-white' : 'text-slate-600'}`} onClick={() => setTab(k)}>
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

      {tab === 'day' && (() => {
        const dayId = d && isValidYmd(d) ? d : today;
        const log = data.logs.get(dayId);
        const mams = scheduledFor(dayId, data.all);
        const st = dayStats(dayId, log, data.all);
        return (
          <>
            <p className="text-sm text-slate-500">Edit this student's log for any day, even locked ones. Each change is stamped with your name, recorded in the audit log, and shown to the student.</p>
            <div className="flex items-center gap-2">
              <button className="btn-secondary px-3" aria-label="Previous day" onClick={() => setAnchor(addDays(dayId, -1))}>
                ←
              </button>
              <input type="date" className="input text-center" value={dayId} max={today} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
              <button className="btn-secondary px-3" aria-label="Next day" disabled={dayId >= today} onClick={() => setAnchor(addDays(dayId, 1))}>
                →
              </button>
            </div>
            <div className="flex items-center justify-between">
              <DateLine day={dayId} />
              <span className="chip bg-slate-100 px-3 py-1 text-sm">{st.hasLog ? pct(st.completion) : 'No log'}</span>
            </div>
            {log?.editedBy && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Last edited by {log.editedByName ?? 'the teacher'}.</div>}
            {mams.length ? (
              <Checklist key={dayId} uid={uid} day={dayId} mamoolaat={mams} log={log} editable asAdmin={actor} />
            ) : (
              <EmptyState>No mamoolaat were set for this day.</EmptyState>
            )}
            {log && (
              <button
                className="btn-ghost text-red-600"
                onClick={async () => (await confirm({ title: 'Clear this whole day?', message: 'Deletes every entry logged on this day for this student.', confirmLabel: 'Clear day', danger: true })) && adminDeleteLog(uid, dayId, actor)}
              >
                Clear this day's log
              </button>
            )}
          </>
        );
      })()}

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
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {c.actorName} · {when(c.createdAt)} · {c.seenAt ? 'seen by student' : 'not seen yet'}
                      </span>
                      <button className="btn-ghost min-h-11 px-3 text-xs text-red-600" onClick={async () => (await confirm({ title: 'Delete this history entry?', confirmLabel: 'Delete', danger: true })) && deleteChange(uid, c.id, actor)}>
                        Delete
                      </button>
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
                    <button className="btn-ghost min-h-8 px-2 text-xs text-red-600" onClick={async () => (await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete', danger: true })) && deleteComment(uid, c.id, actor)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'profile' && (
        <>
          <form
            className="card flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameDraft.trim() && nameDraft.trim() !== student.name) run(renameUser(uid, nameDraft, actor));
            }}
          >
            <label className="label" htmlFor="sname">
              Name
            </label>
            <div className="flex gap-2">
              <input id="sname" className="input" dir="auto" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100} />
              <button className="btn-primary" disabled={!nameDraft.trim() || nameDraft.trim() === student.name}>
                Save
              </button>
            </div>
          </form>
          <div className="card flex flex-col gap-3">
            <div>
              <label className="label">Class</label>
              <ClassSelect classes={classes.data} value={student.classId ?? ''} onChange={(v) => v && run(moveUser(uid, v, actor))} placeholder="No class" />
            </div>
            <div>
              <label className="label" htmlFor="sstatus">
                Status
              </label>
              <select
                id="sstatus"
                className="input"
                value={student.status}
                disabled={!!student.handedOverTo}
                onChange={async (e) => {
                  const v = e.target.value;
                  if (v === student.status) return;
                  const ok = await confirm({ title: `Change status to “${v}”?`, message: v === 'active' ? undefined : 'They lose access until set back to active. Their data is kept.', confirmLabel: 'Change', danger: v !== 'active' });
                  if (!ok) return;
                  if (v === 'active') {
                    if (!student.classId && !classes.data.length) return void notify('No classes yet', 'Create a class first.');
                    await run(reactivateUser(uid, actor));
                  } else if (v === 'inactive') await run(deactivateUser(uid, actor));
                  else if (v === 'rejected') await run(rejectUser(uid, actor));
                  else await run(setPending(uid, actor));
                }}
              >
                <option value="pending">pending (waiting for approval)</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
          </div>
          <button className="btn-danger" onClick={async () => (await del([student])) && nav('/admin/students')}>
            Delete student and all data…
          </button>
        </>
      )}
    </div>
  );
}
