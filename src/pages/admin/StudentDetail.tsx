import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { useStudentLive } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { MamoolEditor } from '../../components/MamoolEditor';
import { EmptyState, Spinner, Stat, StatRow } from '../../components/ui';
import { IconChevronLeft, IconChevronRight } from '../../components/icons';
import { Checklist } from '../../components/Checklist';
import { SalahChecklist } from '../../components/SalahChecklist';
import { SalahWeek } from '../../components/SalahWeek';
import { YearSummary } from '../../components/YearChart';
import { salahStats } from '../../lib/salah';
import { DateLine } from '../../components/DateLine';
import { useDialog } from '../../components/Dialog';
import { useUndo } from '../../components/Undo';
import { ExportBar } from '../../components/ExportBar';
import { downloadCsv } from '../../lib/csv';
import { fileSafe, salahRows, studentDetailRows } from '../../lib/exports';
import { getDocs } from 'firebase/firestore';
import { addComment, adminSaveSalah, pushSubsCol, adminDeleteLog, deactivateUser, deleteChange, deleteComment, moveUser, reactivateUser, rejectUser, renameUser, setPending } from '../../lib/db';
import { addDays, formatGregorian, formatMonth, isValidYmd, monthDays, weekDays, weekStartOf } from '../../lib/dates';
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
  const [push, setPush] = useState(true);
  const [devices, setDevices] = useState<number | null>(null);
  useEffect(() => {
    getDocs(pushSubsCol(uid)).then((s) => setDevices(s.size), () => setDevices(null));
  }, [uid]);
  const [tab, setTab] = useState<'week' | 'day' | 'salah' | 'mamoolaat' | 'comments' | 'profile'>(
    sp.get('tab') === 'day' ? 'day' : sp.get('tab') === 'salah' ? 'salah' : 'week',
  );
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
        ...week.perMamool.map((pm) => ({ key: pm.mamool.id, label: pm.mamool.name, cells: pm.cells, logged: pm.logged, total: pm.completion })),
        { key: '__all', label: <b>All</b>, cells: week.days.map((x) => x.completion), logged: week.days.map((x) => x.hasLog), total: week.completion },
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
            <div className="truncate font-serif text-[28px] leading-tight text-slate-900" dir="auto">
              {displayName(student)}
            </div>
            {student.status !== 'active' && <div className="truncate text-sm text-amber-800">{student.status}</div>}
          </div>
        </div>
      </div>
      {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <StatRow>
        <Stat label="Streak" value={currentStreak(today, data.logs, data.all)} sub={`Best ${bestStreak(today, data.logs, data.all)}`} />
        <Stat label="This week" value={pct(week?.completion)} sub={`${week?.fullDays ?? 0} full days`} />
        <Stat label="Logged" value={[...data.logs.entries()].filter(([d, l]) => d <= today && dayStats(d, l, data.all).hasLog).length} sub="days in total" />
      </StatRow>

      <div className="no-print flex overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Student sections">
        {(
          [
            ['week', 'Week'],
            ['day', 'Day'],
            ['salah', 'Salah'],
            ['mamoolaat', 'Mamoolaat'],
            ['comments', 'Notes'],
            ['profile', 'Profile'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`-mb-px min-h-11 flex-1 border-b-2 px-1 text-[13px] font-medium whitespace-nowrap sm:flex-none sm:px-3 sm:text-sm ${tab === k ? 'border-brand-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab(k)}>
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
          <div className="rounded-xl bg-surface p-2">{rows.length > 1 ? <WeekGrid days={days} rows={rows} today={today} firstHeader="Mamool" /> : <EmptyState>No mamoolaat this week.</EmptyState>}</div>
          <h2 className="section-title mt-2 mb-0">Salah</h2>
          <div className="rounded-xl bg-surface p-2">
            <SalahWeek days={days} salah={data.salah} today={today} admin />
          </div>
          <div className="no-print mt-2">
            <YearSummary quiet today={today} weekStart={settings.weekStart} logs={data.logs} mamoolaat={data.all} salah={data.salah} />
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
            {log && Object.keys(log.entries ?? {}).length > 0 && !hidden.has(`log:${dayId}`) && (
              <button className="btn-ghost text-red-700" onClick={() => later(`log:${dayId}`, `Cleared ${formatGregorian(dayId, { year: undefined })}`, () => adminDeleteLog(uid, dayId, actor))}>
                Clear this day's log
              </button>
            )}
          </>
        );
      })()}

      {tab === 'salah' && (() => {
        const dayId = d && isValidYmd(d) ? d : today;
        const rec = data.salah.get(dayId);
        const wk = weekDays(weekStartOf(dayId, settings.weekStart));
        const st = salahStats(rec);
        const owner = { uid, name: student.name ?? student.email, classId: student.classId };
        return (
          <>
            <div className="no-print flex items-center justify-between">
              <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Previous week" onClick={() => setAnchor(addDays(wk[0], -7))}>
                <IconChevronLeft size={20} />
              </button>
              <div className="num text-sm font-medium text-slate-800">
                {formatGregorian(wk[0], { year: undefined })} – {formatGregorian(wk[6])}
              </div>
              <button className="btn-secondary w-11 shrink-0 px-0" aria-label="Next week" disabled={wk[6] >= today} onClick={() => setAnchor([addDays(wk[0], 7), today].sort()[0])}>
                <IconChevronRight size={20} />
              </button>
            </div>
            <ExportBar
              week={() => downloadCsv(`salah-${fileSafe(displayName(student))}-${wk[0]}.csv`, [['Salah', ...wk, 'Days in jamaat'], ...salahRows(data.salah, wk, today)])}
              monthLabel={formatMonth(dayId)}
              month={() => {
                const md = monthDays(dayId);
                downloadCsv(`salah-${fileSafe(displayName(student))}-${dayId.slice(0, 7)}.csv`, [['Salah', ...md, 'Days in jamaat'], ...salahRows(data.salah, md, today)]);
              }}
            />
            <div className="rounded-xl bg-surface p-2">
              <SalahWeek days={wk} salah={data.salah} today={today} onPick={setAnchor} admin />
            </div>
            <div className="flex items-center justify-between">
              <DateLine day={dayId} />
              <span className="chip num bg-slate-100 px-2.5 py-1 text-sm text-slate-700">{st.inJamaat}/5 in jamaat</span>
            </div>
            <p className="text-sm text-slate-500">Correct this student's salah for any day. Qadha counts as missed here. Each change is stamped with your name and recorded in the audit log. Fajr changes also update the class's Fajr roll.</p>
            {rec?.editedBy && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Last edited by {rec.editedByName ?? 'the teacher'}.</div>}
            <SalahChecklist day={dayId} record={rec} editable noQadha onChange={(n, s) => adminSaveSalah(owner, dayId, n, s, actor)} />
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
              if (text.trim()) addComment(uid, text, actor, push);
              setText('');
            }}
          >
            <label className="label" htmlFor="comment-text">
              Leave a comment (shows on the student's home page)
            </label>
            <textarea id="comment-text" className="input min-h-24" dir="auto" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={push} onChange={(e) => setPush(e.target.checked)} />
              <span>
                Also send it to their phone as a notification
                <span className="block text-xs text-slate-500">
                  {devices === 0
                    ? "They haven't turned notifications on yet, so they'll only see it in the app."
                    : 'Arrives within about 15 minutes. The first 300 characters are sent.'}
                </span>
              </span>
            </label>
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
