import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { DateLine } from '../../components/DateLine';
import { Checklist } from '../../components/Checklist';
import { ReminderBanner } from '../../components/ReminderBanner';
import { ProgressRing, StatCard, Spinner, Badge, cellClass, EmptyState } from '../../components/ui';
import { currentStreak, bestStreak, dayStats, scheduledFor, periodCompletion, pct } from '../../lib/scoring';
import { shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { addMamool, markCommentRead } from '../../lib/db';
import { MamoolForm } from '../../components/MamoolEditor';

export function Home() {
  const { profile, today, settings, actor } = useActiveSession();
  const data = useMyData();
  const [adding, setAdding] = useState(false);
  const { logs, all } = data;

  const stats = useMemo(() => {
    const days = weekDays(weekStartOf(today, settings.weekStart));
    const todayS = dayStats(today, logs.get(today), all);
    const week = days.map((d) => dayStats(d, logs.get(d), all));
    return {
      days,
      todayS,
      week,
      fullDays: week.filter((d) => d.day <= today && d.scheduled > 0 && d.done === d.scheduled).length,
      weekCompletion: periodCompletion(days, logs, all, today),
      streak: currentStreak(today, logs, all),
      best: bestStreak(today, logs, all),
    };
  }, [logs, all, today, settings.weekStart]);

  if (data.loading && !all.length) return <Spinner />;
  const todays = scheduledFor(today, all).filter((m) => m.active);
  const unread = data.comments.filter((c) => !c.readAt);
  const first = profile.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Assalamu alaykum{first ? `, ${first}` : ''}</div>
          <DateLine day={today} />
        </div>
        <ProgressRing value={stats.todayS.completion} size={72} />
      </div>

      <ReminderBanner show={!stats.todayS.hasLog && todays.length > 0} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="🔥" label="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} sub={`Best: ${stats.best}`} />
        <StatCard icon="✅" label="Today" value={`${stats.todayS.done}/${stats.todayS.scheduled}`} sub="done" />
        <StatCard icon="📅" label="This week" value={pct(stats.weekCompletion)} sub="complete" />
        <StatCard icon="💯" label="Full days" value={stats.fullDays} sub="this week" />
      </div>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <div className="section-title mb-0">This week</div>
          <Link to="/week" className="text-sm font-semibold text-brand-700">
            Details →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {stats.week.map((d) => (
            <Link to={`/log/${d.day}`} key={d.day} className="flex flex-col items-center gap-1">
              <span className={`text-xs font-semibold ${d.day === today ? 'text-brand-700' : 'text-slate-500'}`}>{shortDay(d.day)}</span>
              <span
                className={`flex h-10 w-full items-center justify-center rounded-lg text-xs font-bold ${
                  d.day > today ? 'bg-slate-50 text-slate-300' : cellClass(d.scheduled ? d.completion : null)
                } ${d.day === today ? 'ring-2 ring-brand-500' : ''}`}
              >
                {d.day > today ? '' : d.scheduled ? Math.round(d.completion * 100) : '–'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {(unread.length > 0 || data.unseenChanges > 0) && (
        <section className="card ring-2 ring-gold-400/60">
          <div className="mb-2 flex items-center justify-between">
            <div className="section-title mb-0">
              From your teacher <Badge n={unread.length + data.unseenChanges} />
            </div>
            <Link to="/messages" className="text-sm font-semibold text-brand-700">
              All →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {unread.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-xl bg-sand-50 p-3">
                <p className="flex-1 whitespace-pre-wrap" dir="auto">
                  {c.text}
                </p>
                <button className="btn-ghost min-h-9 px-2 text-sm" onClick={() => markCommentRead(profile.id, c.id)}>
                  Mark read
                </button>
              </li>
            ))}
            {data.unseenChanges > 0 && (
              <li className="text-sm text-slate-600">
                Your teacher changed your mamoolaat ({data.unseenChanges} change{data.unseenChanges > 1 ? 's' : ''}).{' '}
                <Link className="font-semibold text-brand-700 underline" to="/messages">
                  See what changed
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="section-title mb-0">Today's checklist</div>
          <Link to="/mamoolaat" className="text-sm font-semibold text-brand-700">
            Edit list
          </Link>
        </div>
        {todays.length ? (
          <Checklist uid={profile.id} day={today} mamoolaat={todays} log={logs.get(today)} editable />
        ) : (
          <EmptyState>No mamoolaat yet. Add your first one below.</EmptyState>
        )}

        {adding ? (
          <div className="card mt-3">
            <div className="section-title">Add a mamool</div>
            <MamoolForm
              submitLabel="+ Add to my list"
              onCancel={() => setAdding(false)}
              onSubmit={(v) => {
                const next = all.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);
                addMamool(profile.id, v, next, today, actor);
                setAdding(false);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">It appears on today's checklist straight away. Past days are not changed.</p>
          </div>
        ) : (
          <button className="btn-secondary mt-3 w-full" onClick={() => setAdding(true)}>
            ＋ Add a mamool
          </button>
        )}
      </section>
    </div>
  );
}
