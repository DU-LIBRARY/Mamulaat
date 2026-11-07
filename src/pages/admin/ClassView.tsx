import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange } from '../../hooks/useAdminData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Spinner, cellClass } from '../../components/ui';
import { targetLabel } from '../../components/Checklist';
import { addDays, formatGregorian, isValidYmd, weekDays, weekStartOf } from '../../lib/dates';
import { dayStats, entryFraction, pct, scheduledFor } from '../../lib/scoring';
import { studentWeek } from '../../lib/reports';
import { downloadCsv } from '../../lib/csv';
import type { LogEntry } from '../../types';

function entryText(e: LogEntry | undefined) {
  if (!e) return { icon: '·', cls: 'bg-slate-100 text-slate-500', text: 'not logged' };
  if (e.status === 'done') return { icon: '✓', cls: 'bg-brand-100 text-brand-900', text: 'done' };
  if (e.status === 'missed') return { icon: '✕', cls: 'bg-red-100 text-red-800', text: 'missed' };
  return { icon: '½', cls: 'bg-amber-100 text-amber-900', text: `${e.amount}/${e.target}` };
}

export function ClassView() {
  const { classId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { today, settings } = useActiveSession();
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
  const range = useStudentsRange(students.map((s) => s.id), from, to);

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

  const exportCsv = () => {
    const header = ['Student', 'Email', 'Mamool', 'Target', ...days, 'Week %', 'Week points'];
    const rows: (string | number | null)[][] = [header];
    for (const w of weeks) {
      rows.push([w.student.name ?? '', w.student.email, 'ALL', '', ...w.days.map((d) => (d.completion == null ? '' : Math.round(d.completion * 100))), w.completion == null ? '' : Math.round(w.completion * 100), w.points]);
      for (const pm of w.perMamool) {
        rows.push([w.student.name ?? '', w.student.email, pm.mamool.name, targetLabel(pm.mamool), ...pm.cells.map((c) => (c == null ? '' : Math.round(c * 100))), pm.completion == null ? '' : Math.round(pm.completion * 100), '']);
      }
    }
    downloadCsv(`mamulaat-${cls.name.replace(/\W+/g, '_')}-${days[0]}.csv`, rows);
  };

  const gridRows: GridRow[] = weeks.map((w) => ({
    key: w.student.id,
    label: w.student.name ?? w.student.email,
    to: `/admin/student/${w.student.id}?date=${days[0]}`,
    cells: w.days.map((d) => d.completion),
    total: w.completion,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold" dir="auto">
          {cls.name}
        </h2>
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {(['day', 'week'] as const).map((v) => (
            <button key={v} className={`btn min-h-9 px-4 text-sm ${view === v ? 'bg-brand-700 text-white' : 'text-slate-600'}`} onClick={() => setParam('view', v)}>
              {v === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-secondary px-3" onClick={() => setParam('date', addDays(date, view === 'week' ? -7 : -1))}>
          ←
        </button>
        <input type="date" className="input text-center" value={date} max={today} onChange={(e) => e.target.value && setParam('date', e.target.value)} />
        <button className="btn-secondary px-3" disabled={addDays(date, view === 'week' ? 7 : 1) > today && date === today} onClick={() => setParam('date', [addDays(date, view === 'week' ? 7 : 1), today].sort()[0])}>
          →
        </button>
      </div>

      {students.length === 0 && <EmptyState>No active students in this class.</EmptyState>}

      {view === 'day' ? (
        <>
          <DateLine day={date} />
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
                      {s.name ?? s.email}
                    </span>
                    <span className={`chip px-3 py-1 text-sm ${cellClass(st.scheduled ? (st.hasLog ? st.completion : 0) : null)}`}>{st.hasLog ? pct(st.completion) : 'No log'}</span>
                  </Link>
                  {!r?.loaded ? (
                    <div className="text-sm text-slate-400">Loading…</div>
                  ) : mams.length === 0 ? (
                    <div className="text-sm text-slate-400">No mamoolaat set.</div>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {mams.map((m) => {
                        const e = log?.entries[m.id];
                        const t = entryText(e);
                        return (
                          <li key={m.id} className={`rounded-lg px-2 py-1 text-sm ${t.cls}`} title={`${Math.round(entryFraction(e) * 100)}%`}>
                            <b>{t.icon}</b> <span dir="auto">{m.name}</span> <span className="opacity-70">({e?.status === 'partial' ? `${e.amount}/${targetLabel(m)}` : targetLabel(m)})</span>
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {formatGregorian(days[0])} – {formatGregorian(days[6])}
            </div>
            <button className="btn-secondary px-3 text-sm" onClick={exportCsv} disabled={!students.length}>
              ⬇ CSV
            </button>
          </div>
          {students.length > 0 && (
            <div className="card p-2">
              <WeekGrid days={days} rows={gridRows} today={today} firstHeader="Student" />
            </div>
          )}
          <p className="text-xs text-slate-500">Percent of each student's own mamoolaat completed per day. Tap a student for the per-mamool breakdown.</p>
        </>
      )}
    </div>
  );
}
