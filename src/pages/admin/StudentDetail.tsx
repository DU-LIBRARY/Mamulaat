import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { sortMamoolaat, useStudentLive } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { MamoolEditor, MamoolForm } from '../../components/MamoolEditor';
import { EmptyState, Spinner, Stat, StatRow } from '../../components/ui';
import { IconChevronLeft, IconChevronRight } from '../../components/icons';
import { Checklist, targetLabel } from '../../components/Checklist';
import { DateLine } from '../../components/DateLine';
import { useDialog } from '../../components/Dialog';
import { useUndo } from '../../components/Undo';
import { ExportBar } from '../../components/ExportBar';
import { downloadCsv } from '../../lib/csv';
import { fileSafe, studentDetailRows } from '../../lib/exports';
import { addComment, addMamool, adminDeleteLog, deactivateUser, deleteChange, deleteComment, moveUser, reactivateUser, rejectUser, removeMamool, renameUser, restoreMamool, setPending, type Actor } from '../../lib/db';
import type { Mamool } from '../../types';
import { addDays, formatGregorian, formatMonth, isValidYmd, monthDays, weekDays, weekStartOf } from '../../lib/dates';
import { studentWeek } from '../../lib/reports';
import { bestStreak, currentStreak, dayStats, pct, scheduledFor } from '../../lib/scoring';
import { ClassSelect, useDeleteUsers } from './Students';
import { describeChange } from '../student/Messages';
import { displayName } from '../../lib/display';

function when(ts?: { toDate(): Date } | null) {
  return ts ? ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'pending sync';
}

/** Quick add / remove / restore of a student's mamoolaat, shown under the weekly grid. */
function WeekMamoolaat({ uid, all, today, actor }: { uid: string; all: Mamool[]; today: string; actor: Actor }) {
  const undo = useUndo();
  const [adding, setAdding] = useState(false);
  const active = sortMamoolaat(all.filter((m) => m.active));
  const removed = sortMamoolaat(all.filter((m) => !m.active));
  const nextOrder = all.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title mb-0">Mamoolaat</h2>
        {!adding && (
          <button className="btn-secondary min-h-11 px-3" onClick={() => setAdding(true)}>
            Add
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Changes apply from today; past days keep their history. Each change is recorded and shown to the student.</p>
      {adding && (
        <MamoolForm
          submitLabel="Add"
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            addMamool(uid, v, nextOrder, today, actor);
            setAdding(false);
          }}
        />
      )}
      {active.length === 0 ? (
        <EmptyState>No active mamoolaat.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200">
          {active.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="font-medium break-words text-slate-900" dir="auto">
                  {m.name}
                </div>
                <div className="text-sm text-slate-500" dir="auto">
                  {targetLabel(m)}
                </div>
              </div>
              <button
                className="btn-ghost min-h-11 px-3 text-red-700"
                aria-label={`Remove ${m.name}`}
                onClick={() => {
                  removeMamool(uid, m, today, actor);
                  undo.undoable(`Removed “${m.name}”`, () => restoreMamool(uid, { ...m, active: false, removedDate: today }, today, actor));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {removed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-600">Removed ({removed.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {removed.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-slate-500 line-through" dir="auto">
                  {m.name} – {targetLabel(m)}
                </span>
                <button className="btn-ghost min-h-11 shrink-0 px-3 text-sm" onClick={() => restoreMamool(uid, m, today, actor)} aria-label={`Restore ${m.name}`}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
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
  const undo = useUndo();
  // Deletes wait a few seconds (with Undo) before they happen; hide them meanwhile.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string, on: boolean) =>
    setHidden((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const later = (id: string, message: string, commit: () => void) => {
    hide(id, true);
    undo.deferred(message, commit);
    // If Undo is pressed the commit never runs; show the item again once the toast is gone.
    setTimeout(() => hide(id, false), 6500);
  };
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
            <div className="truncate text-lg font-semibold text-slate-900" dir="auto">
              {displayName(student)}
            </div>
            <div className="truncate text-sm text-slate-500">
              {student.status}
            </div>
          </div>
        </div>
      </div>
      {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <StatRow>
        <Stat label="Streak" value={currentStreak(today, data.logs, data.all)} sub={`Best ${bestStreak(today, data.logs, data.all)}`} />
        <Stat label="This week" value={pct(week?.completion)} sub={`${week?.fullDays ?? 0} full days`} />
        <Stat label="Logged" value={[...data.logs.keys()].filter((d) => d <= today).length} sub="days in total" />
      </StatRow>

      <div className="no-print -mx-4 flex overflow-x-auto border-b border-slate-200 px-4" role="tablist" aria-label="Student sections">
        {(
          [
            ['week', 'Weekly'],
            ['day', 'Day'],
            ['mamoolaat', 'Mamoolaat'],
            ['comments', `Notes (${data.comments.length})`],
            ['profile', 'Profile'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${tab === k ? 'border-brand-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'week' && (
        <>
          <div className="no-print flex items-center justify-between">
            <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Previous week" onClick={() => setAnchor(addDays(days[0], -7))}>
              <IconChevronLeft size={20} />
            </button>
            <div className="num text-sm font-medium text-slate-800">
              {formatGregorian(days[0], { year: undefined })} – {formatGregorian(days[6])}
            </div>
            <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Next week" disabled={days[6] >= today} onClick={() => setAnchor([addDays(days[0], 7), today].sort()[0])}>
              <IconChevronRight size={20} />
            </button>
          </div>
          <h2 className="print-only text-lg font-semibold" dir="auto">
            {displayName(student)} — {formatGregorian(days[0])} – {formatGregorian(days[6])}
          </h2>
          <ExportBar
            week={() => downloadCsv(`mamulaat-${fileSafe(displayName(student))}-${days[0]}.csv`, studentDetailRows(data.all, data.logs, days, today))}
            monthLabel={formatMonth(anchor)}
            month={() => {
              const md = monthDays(anchor);
              downloadCsv(`mamulaat-${fileSafe(displayName(student))}-${anchor.slice(0, 7)}.csv`, studentDetailRows(data.all, data.logs, md, today));
            }}
          />
          <div className="rounded-lg border border-slate-200 bg-surface p-2">{rows.length > 1 ? <WeekGrid days={days} rows={rows} today={today} firstHeader="Mamool" /> : <EmptyState>No mamoolaat this week.</EmptyState>}</div>
          <div className="no-print">
            <WeekMamoolaat uid={uid} all={data.all} today={today} actor={actor} />
          </div>
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
              <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Previous day" onClick={() => setAnchor(addDays(dayId, -1))}>
                <IconChevronLeft size={20} />
              </button>
              <input type="date" aria-label="Day" className="input text-center" value={dayId} max={today} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
              <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Next day" disabled={dayId >= today} onClick={() => setAnchor(addDays(dayId, 1))}>
                <IconChevronRight size={20} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <DateLine day={dayId} />
              <span className="chip num bg-slate-100 px-2.5 py-1 text-sm text-slate-700">{st.hasLog ? pct(st.completion) : 'No log'}</span>
            </div>
            {log?.editedBy && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Last edited by {log.editedByName ?? 'the teacher'}.</div>}
            {hidden.has(`log:${dayId}`) ? (
              <EmptyState>This day's log will be cleared.</EmptyState>
            ) : mams.length ? (
              <Checklist key={dayId} uid={uid} day={dayId} mamoolaat={mams} log={log} editable asAdmin={actor} />
            ) : (
              <EmptyState>No mamoolaat were set for this day.</EmptyState>
            )}
            {log && !hidden.has(`log:${dayId}`) && (
              <button className="btn-ghost text-red-700" onClick={() => later(`log:${dayId}`, `Cleared ${formatGregorian(dayId, { year: undefined })}`, () => adminDeleteLog(uid, dayId, actor))}>
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
              <h2 className="section-title">Change history</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {data.changes.filter((c) => !hidden.has(c.id)).map((c) => (
                  <li key={c.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <div dir="auto">{describeChange(c)}</div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {c.actorName} · {when(c.createdAt)} · {c.seenAt ? 'seen by student' : 'not seen yet'}
                      </span>
                      <button className="btn-ghost min-h-11 px-3 text-xs text-red-700" onClick={() => later(c.id, 'History entry deleted', () => deleteChange(uid, c.id, actor))}>
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
            <label className="label" htmlFor="comment-text">
              Leave a comment (shows on the student's home page)
            </label>
            <textarea id="comment-text" className="input min-h-24" dir="auto" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
            <button className="btn-primary" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
          {data.comments.length === 0 ? (
            <EmptyState>No comments yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.comments.filter((c) => !hidden.has(c.id)).map((c) => (
                <li key={c.id} className="card p-3">
                  <p className="whitespace-pre-wrap" dir="auto">
                    {c.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {when(c.createdAt)} · {c.readAt ? `read ${when(c.readAt)}` : 'unread'}
                    </span>
                    <button className="btn-ghost min-h-11 px-3 text-xs text-red-700" onClick={() => later(c.id, 'Comment deleted', () => deleteComment(uid, c.id, actor))}>
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
              <span className="label">Class</span>
              <ClassSelect label="Class" classes={classes.data} value={student.classId ?? ''} onChange={(v) => v && run(moveUser(uid, v, actor))} placeholder="No class" />
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
