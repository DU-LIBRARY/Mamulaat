import { useMemo, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { WeekGrid, type GridRow } from '../../components/WeekGrid';
import { Stat, StatRow } from '../../components/ui';
import { IconChevronLeft, IconChevronRight } from '../../components/icons';
import { addDays, formatGregorian, weekDays, weekStartOf } from '../../lib/dates';
import { countingFor, dayStats, entryFraction, isOffDay, mamoolCompletion, periodCompletion, pct, scheduledFor } from '../../lib/scoring';

export function Week() {
  const { today, settings } = useActiveSession();
  const { logs, all } = useMyData();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStartOf(today, settings.weekStart), offset * 7);
  const days = weekDays(start);

  const { rows, completion, fullDays } = useMemo(() => {
    const inWeek = all.filter((m) => days.some((d) => scheduledFor(d, [m]).length));
    const rows: GridRow[] = inWeek.map((m) => ({
      key: m.id,
      label: m.name,
      cells: days.map((d) => (countingFor(d, logs.get(d), [m]).length ? entryFraction(logs.get(d)?.entries[m.id]) : null)),
      logged: days.map((d) => !!logs.get(d)?.entries?.[m.id]),
      off: days.map((d) => isOffDay(logs.get(d))),
      total: mamoolCompletion(m, days, logs, today, all),
    }));
    const stats = days.filter((d) => d <= today).map((d) => dayStats(d, logs.get(d), all));
    rows.push({
      key: '__total',
      label: <b>All</b>,
      cells: days.map((d) => {
        const s = dayStats(d, logs.get(d), all);
        return s.scheduled ? s.completion : null;
      }),
      logged: days.map((d) => dayStats(d, logs.get(d), all).hasLog),
      off: days.map((d) => isOffDay(logs.get(d))),
      total: periodCompletion(days, logs, all, today),
    });
    return {
      rows,
      completion: periodCompletion(days, logs, all, today),
      fullDays: stats.filter((s) => s.scheduled && s.done === s.scheduled).length,
    };
  }, [all, logs, days.join(), today]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button className="btn-secondary w-11 px-0" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
          <IconChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold text-slate-900">{offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week of'}</div>
          <div className="text-sm text-slate-500">
            {formatGregorian(days[0], { weekday: undefined, year: undefined })} – {formatGregorian(days[6], { weekday: undefined })}
          </div>
        </div>
        <button className="btn-secondary w-11 px-0" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next week">
          <IconChevronRight size={20} />
        </button>
      </div>
      <StatRow>
        <Stat label="Complete" value={pct(completion)} />
        <Stat label="Full days" value={fullDays} />
      </StatRow>
      <div className="rounded-lg border border-slate-200 bg-surface p-2">
        <WeekGrid days={days} rows={rows} today={today} firstHeader="Mamool" />
      </div>
      <p className="text-xs text-slate-500">
        A day counts toward your streak at 50%+
        completion. Only you and your teacher can see this.
      </p>
    </div>
  );
}
