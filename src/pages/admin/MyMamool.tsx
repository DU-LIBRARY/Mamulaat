import { useEffect, useMemo, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useStudentLive } from '../../hooks/useStudentData';
import { DateLine } from '../../components/DateLine';
import { Checklist } from '../../components/Checklist';
import { MamoolEditor } from '../../components/MamoolEditor';
import { EmptyState, SegmentBar, Spinner, Stat, StatRow } from '../../components/ui';
import { IconPencil } from '../../components/icons';
import { currentStreak, dayStats, entryFraction, pct, periodCompletion, scheduledFor } from '../../lib/scoring';
import { weekDays, weekStartOf } from '../../lib/dates';

/** The admin's landing page: their own mamool. Mark today at the top; add and edit it under a small tab. */
export function MyMamool() {
  const { profile, today, settings, actor } = useActiveSession();
  const data = useStudentLive(profile.id);
  const [open, setOpen] = useState(false);
  const { logs, all } = data;
  // Nothing set up yet: open the Add / edit tab straight away (and keep it open while they add).
  const empty = !data.loading && all.length === 0;
  useEffect(() => {
    if (empty) setOpen(true);
  }, [empty]);

  const stats = useMemo(() => {
    const days = weekDays(weekStartOf(today, settings.weekStart));
    return {
      todayS: dayStats(today, logs.get(today), all),
      week: periodCompletion(days, logs, all, today),
      streak: currentStreak(today, logs, all),
    };
  }, [logs, all, today, settings.weekStart]);

  if (data.loading && !all.length) return <Spinner />;
  const todays = scheduledFor(today, all).filter((m) => m.active);
  const todayLog = logs.get(today);
  const first = profile.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="text-sm text-slate-500" dir="auto">
          Assalamu alaykum{first ? `, ${first}` : ''}
        </div>
        <div className="mt-1 flex items-end justify-between gap-4">
          <DateLine day={today} size="lg" />
          {todays.length > 0 && (
            <div className="shrink-0 text-right">
              <div className="num text-2xl leading-none font-semibold text-slate-900">
                {stats.todayS.done}
                <span className="text-slate-400">/{stats.todayS.scheduled}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">done today</div>
            </div>
          )}
        </div>
        <SegmentBar className="mt-4" fractions={todays.map((m) => entryFraction(todayLog?.entries?.[m.id]))} />
      </header>

      <section aria-labelledby="my-today">
        <h2 id="my-today" className="section-title">My mamool today</h2>
        {todays.length ? (
          <Checklist uid={profile.id} day={today} mamoolaat={todays} log={todayLog} editable self={actor} compact />
        ) : (
          <EmptyState>{all.length ? 'Nothing is set for today.' : 'You have no mamool yet. Add your first one below.'}</EmptyState>
        )}
      </section>

      {todays.length > 0 && (
        <StatRow>
          <Stat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
          <Stat label="This week" value={pct(stats.week)} sub="complete" />
          <Stat label="Today" value={pct(stats.todayS.completion)} sub="complete" />
        </StatRow>
      )}

      <section>
        <div className="-mx-4 flex border-b border-slate-200 px-4" role="tablist" aria-label="My mamool">
          <button
            role="tab"
            aria-selected={open}
            aria-controls="my-edit-panel"
            className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${
              open ? 'border-brand-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setOpen((o) => !o)}
          >
            <IconPencil size={15} />
            Add / edit
          </button>
        </div>
        {open && (
          <div id="my-edit-panel" role="tabpanel" className="pt-4">
            <p className="mb-3 text-sm text-slate-500">Changes apply from today. Past days keep their history.</p>
            <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
          </div>
        )}
      </section>
    </div>
  );
}
