import { IconCheck, IconChevronLeft, IconChevronRight, IconHalf, IconX } from '../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange, useStudentsSalah } from '../../hooks/useAdminData';
import { useDocData } from '../../hooks/useFirestore';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Spinner, cellClass } from '../../components/ui';
import { targetLabel } from '../../components/Checklist';
import { addDays, formatGregorian, formatMonth, isValidYmd, monthDays, weekDays, weekStartOf } from '../../lib/dates';
import { dayStats, entryFraction, pct, scheduledFor } from '../../lib/scoring';
import { studentWeek } from '../../lib/reports';
import { downloadCsv } from '../../lib/csv';
import { fetchStudentsRange, rosterRef, setFajrMonitor, syncRoster } from '../../lib/db';
import { fajrRollSummary } from '../../lib/salah';
import { fileSafe, registerRows } from '../../lib/exports';
import { ExportBar } from '../../components/ExportBar';
import type { ClassRoster, FajrRoll, LogEntry } from '../../types';
import { displayName } from '../../lib/display';

function entryText(e: LogEntry | undefined) {
  if (!e) return { icon: null, cls: 'bg-slate-100 text-slate-700', text: 'not logged' };
  if (e.status === 'done') return { icon: <IconCheck size={14} />, cls: 'bg-brand-100 text-brand-900', text: 'done' };
  if (e.status === 'missed') return { icon: <IconX size={13} />, cls: 'bg-red-100 text-red-800', text: 'missed' };
  return { icon: <IconHalf size={12} />, cls: 'bg-amber-100 text-amber-900', text: `${e.amount}/${e.target}` };
}

export function ClassView() {
  const { classId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { today, settings, actor } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const cls = classes.data.find((c) => c.id === classId);
  const view = sp.get('view') === 'week' ? 'week' : 'day';
  const dateParam = sp.get('date');
  const date = dateParam && isValidYmd(dateParam) && dateParam <= today ? dateParam : today;
  const students = users.data.filter((u) => u.classId === classId && u.status === 'active' && u.role === 'student');
  const days = weekDays(weekStartOf(date, settings.weekStart));
  const from = view === 'week' ? days[0] : date;
  const to = view === 'week' ? days[6] : date;
  // Next is only useful when there is something after what is shown: after today (day view) or after the week containing today (week view).
  const nextDisabled = view === 'week' ? days[6] >= today : date >= today;
  const range = useStudentsRange(students.map((s) => s.id), from, to);
  const salah = useStudentsSalah(students.map((s) => s.id), date, date);
  const roster = useDocData<ClassRoster>(classId ? rosterRef(classId) : null, `roster:${classId}`);
  const rosterNames = useMemo(() => Object.fromEntries(students.map((s) => [s.id, displayName(s)])), [students]);
  const monitorId = cls?.fajrMonitorId ?? null;
  // The monitor's "not logged yet" list needs the class's names; keep them current while a monitor is set.
  useEffect(() => {
    if (monitorId && !roster.loading && !users.loading) syncRoster(classId, roster.data?.names, rosterNames);
  }, [monitorId, classId, roster.loading, roster.data, rosterNames, users.loading]);
  const [monitorErr, setMonitorErr] = useState<string | null>(null);

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    n.set(k, v);
    setSp(n, { replace: true });
  };

  const weeks = useMemo(
    () =>
      students.map((s) => {
        const r = range.get(s.id);
        return studentWeek(s, days, r?.mamoolaat ?? [], r?.logs ?? new Map(), today);
      }),
    [students, range, days.join(), today],
  );

  if (users.loading || classes.loading) return <Spinner />;
  if (!cls) return <EmptyState>Class not found.</EmptyState>;

  const className = () => cls.name;
  const exportWeek = () =>
    downloadCsv(
      `mamulaat-${fileSafe(cls.name)}-${days[0]}.csv`,
      registerRows(students, new Map(students.map((s) => [s.id, range.get(s.id) ?? { mamoolaat: [], logs: new Map() }])), days, today, className),
    );
  const exportMonth = async () => {
    const md = monthDays(date);
    const data = await fetchStudentsRange(students.map((s) => s.id), md[0], md[md.length - 1]);
    downloadCsv(`mamulaat-${fileSafe(cls.name)}-${date.slice(0, 7)}.csv`, registerRows(students, data, md, today, className));
  };

  const gridRows: GridRow[] = weeks.map((w) => ({
    key: w.student.id,
    label: displayName(w.student),
    to: `/admin/student/${w.student.id}?date=${days[0]}`,
    cells: w.days.map((d) => d.completion),
    logged: w.days.map((d) => d.hasLog),
    total: w.completion,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* the title gets the full width on phones; the Day/Week switch sits beside it from sm up */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="display text-[34px] leading-tight" dir="auto">
          {cls.name}
        </h1>
        <div className="no-print flex rounded-md border border-slate-200 bg-surface p-0.5" role="group" aria-label="View">
          {(['day', 'week'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} className={`btn min-h-11 rounded px-4 text-sm ${view === v ? 'bg-ink text-white' : 'text-slate-600 hover:text-slate-900'}`} onClick={() => setParam('view', v)}>
              {v === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      <div className="no-print flex items-center gap-2">
        <button className="btn-secondary w-11 shrink-0 px-0" aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => setParam('date', addDays(date, view === 'week' ? -7 : -1))}>
          <IconChevronLeft size={20} />
        </button>
        <input type="date" aria-label="Date" className="input text-center" value={date} max={today} onChange={(e) => e.target.value && setParam('date', e.target.value)} />
        <button className="btn-secondary w-11 shrink-0 px-0" aria-label={view === 'week' ? 'Next week' : 'Next day'} disabled={nextDisabled} onClick={() => setParam('date', [addDays(date, view === 'week' ? 7 : 1), today].sort()[0])}>
          <IconChevronRight size={20} />
        </button>
      </div>

      {students.length === 0 && <EmptyState>No active students in this class.</EmptyState>}

      {view === 'day' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DateLine day={date} />
            {students.length > 0 && <ExportBar month={exportMonth} monthLabel={formatMonth(date)} />}
          </div>
          {students.length > 0 && (() => {
            const roll: FajrRoll = { id: date, r: {} };
            for (const st of students) {
              const f = salah.get(st.id)?.get(date)?.entries?.fajr;
              if (f) roll.r![st.id] = { name: displayName(st), status: f };
            }
            const sum = fajrRollSummary(rosterNames, roll);
            const names = (l: { name: string }[]) => l.map((p) => p.name).join(', ');
            return (
              <section className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="section-title mb-0">Fajr</h2>
                  <span className="num text-sm text-slate-600">
                    {sum.inJamaat.length} in jamaat · {sum.qadha.length} qadha · {sum.missed.length} missed · {sum.notLogged.length} not logged
                  </span>
                </div>
                {sum.missed.length > 0 && <p className="text-sm" dir="auto"><span className="font-medium text-red-800">Missed:</span> {names(sum.missed)}</p>}
                {sum.qadha.length > 0 && <p className="text-sm" dir="auto"><span className="font-medium text-amber-800">Qadha:</span> {names(sum.qadha)}</p>}
                {sum.notLogged.length > 0 && <p className="text-sm text-slate-600" dir="auto"><span className="font-medium">Not logged:</span> {names(sum.notLogged)}</p>}
                <label className="no-print flex flex-col gap-1 border-t border-slate-200 pt-3 text-sm">
                  <span className="text-slate-900">Fajr monitor</span>
                  <span className="text-xs text-slate-500">
                    This student sees the class's daily Fajr roll (missed, qadha, not logged) in their app and gets a push each morning at {settings.fajrReportTime}. They see nothing else of anyone's. Every student in the class is told who it is.
                  </span>
                  <select
                    className="input mt-1"
                    value={monitorId ?? ''}
                    onChange={(e) => {
                      const next = students.find((x) => x.id === e.target.value) ?? null;
                      setFajrMonitor(cls, next, rosterNames, actor).then(() => setMonitorErr(null), (er) => setMonitorErr((er as Error).message));
                    }}
                  >
                    <option value="">Nobody</option>
                    {monitorId && !students.some((x) => x.id === monitorId) && (
                      <option value={monitorId}>{cls.fajrMonitorName ?? 'Someone'} (no longer in this class)</option>
                    )}
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {displayName(st)}
                      </option>
                    ))}
                  </select>
                  {monitorErr && <span className="text-sm text-red-700">{monitorErr}</span>}
                </label>
              </section>
            );
          })()}
          <ul className="flex flex-col gap-3">
            {students.map((s) => {
              const r = range.get(s.id);
              const log = r?.logs.get(date);
              const mams = scheduledFor(date, r?.mamoolaat ?? []);
              const st = dayStats(date, log, r?.mamoolaat ?? []);
              return (
                <li key={s.id} className="card p-3">
                  <Link to={`/admin/student/${s.id}?date=${date}`} className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate font-semibold" dir="auto">
                      {displayName(s)}
                    </span>
                    <span className={`chip px-3 py-1 text-sm ${cellClass(st.scheduled ? (st.hasLog ? st.completion : 0) : null)}`}>{st.hasLog ? pct(st.completion) : 'No log'}</span>
                  </Link>
                  {!r?.loaded ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : mams.length === 0 ? (
                    <div className="text-sm text-slate-500">No mamoolaat set.</div>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {mams.map((m) => {
                        const e = log?.entries[m.id];
                        const t = entryText(e);
                        return (
                          <li key={m.id} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${t.cls}`} title={`${Math.round(entryFraction(e) * 100)}%`}>
                            {t.icon && <span aria-hidden className="inline-flex">{t.icon}</span>}
                            <span className="sr-only">{t.text}:</span> <span dir="auto">{m.name}</span> <span className="num">({e?.status === 'partial' ? `${e.amount}/${targetLabel(m)}` : targetLabel(m)})</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              {formatGregorian(days[0])} – {formatGregorian(days[6])}
            </div>
            {students.length > 0 && <ExportBar week={exportWeek} month={exportMonth} monthLabel={formatMonth(date)} />}
          </div>
          {students.length > 0 && (
            <div className="rounded-xl bg-surface p-2">
              <WeekGrid days={days} rows={gridRows} today={today} firstHeader="Student" />
            </div>
          )}
          <p className="text-xs text-slate-500">Percent of each student's own mamoolaat completed per day. Tap a student for the per-mamool breakdown.</p>
        </>
      )}
    </div>
  );
}
