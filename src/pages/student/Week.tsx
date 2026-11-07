import { useMemo, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { StatCard } from '../../components/ui';
import { addDays, formatGregorian, weekDays, weekStartOf } from '../../lib/dates';
import { dayStats, entryFraction, mamoolCompletion, periodCompletion, pct, scheduledFor } from '../../lib/scoring';

export function Week() {
  const { today, settings } = useActiveSession();
  const { logs, all } = useMyData();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStartOf(today, settings.weekStart), offset * 7);
  const days = weekDays(start);

  const { rows, points, completion, fullDays } = useMemo(() => {
    const inWeek = all.filter((m) => days.some((d) => scheduledFor(d, [m]).length));
    const rows: GridRow[] = inWeek.map((m) => ({
      key: m.id,
      label: m.name,
      cells: days.map((d) => (scheduledFor(d, [m]).length ? entryFraction(logs.get(d)?.entries[m.id]) : null)),
      total: mamoolCompletion(m, days, logs, today),
    }));
    const stats = days.filter((d) => d <= today).map((d) => dayStats(d, logs.get(d), all));
    rows.push({
      key: '__total',
      label: <b>All</b>,
      cells: days.map((d) => {
        const s = dayStats(d, logs.get(d), all);
        return s.scheduled ? s.completion : null;
      }),
      total: periodCompletion(days, logs, all, today),
    });
    return {
      rows,
      points: stats.reduce((s, d) => s + d.points, 0),
      completion: periodCompletion(days, logs, all, today),
      fullDays: stats.filter((s) => s.scheduled && s.done === s.scheduled).length,
    };
  }, [all, logs, days.join(), today]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button className="btn-secondary px-3" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
          ←
        </button>
        <div className="text-center">
          <div className="font-bold">{offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week of'}</div>
          <div className="text-sm text-slate-500">
            {formatGregorian(days[0], { weekday: undefined, year: undefined })} – {formatGregorian(days[6], { weekday: undefined })}
          </div>
        </div>
        <button className="btn-secondary px-3" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next week">
          →
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="⭐" label="Points" value={points} />
        <StatCard icon="✅" label="Complete" value={pct(completion)} />
        <StatCard icon="💯" label="Full days" value={fullDays} />
      </div>
      <div className="card p-2">
        <WeekGrid days={days} rows={rows} today={today} firstHeader="Mamool" />
      </div>
      <p className="text-xs text-slate-500">
        Points: 10 per mamool done (partial = proportional), +5 for a full day. A day counts toward your streak at 50%+
        completion. Only you and your teacher can see this.
      </p>
    </div>
  );
}
