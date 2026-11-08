import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { DateLine } from '../../components/DateLine';
import { Checklist } from '../../components/Checklist';
import { ReminderBanner } from '../../components/ReminderBanner';
import { Spinner, Badge, cellClass, EmptyState, Notice, SegmentBar, StatRow, Stat } from '../../components/ui';
import { IconBell, IconLock, IconPlus } from '../../components/icons';
import { LastChanceNotice, PendingSyncNotice } from '../../components/LockNotices';
import { useDocData } from '../../hooks/useFirestore';
import { currentStreak, bestStreak, dayStats, scheduledFor, periodCompletion, pct, entryFraction } from '../../lib/scoring';
import { formatGregorian, isDayEditable, shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { addMamool, markCommentRead, nudgeRef } from '../../lib/db';
import type { Nudge } from '../../types';
import { MamoolForm } from '../../components/MamoolEditor';
import { NotificationPrompt } from '../../components/NotificationSetup';

export function Home() {
  const { profile, today, settings, actor } = useActiveSession();
  const data = useMyData();
  const [adding, setAdding] = useState(false);
  const { logs, all } = data;
  const nudge = useDocData<Nudge>(nudgeRef(profile.id, today), `nudge:${profile.id}:${today}`);

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
  const todayLog = logs.get(today);
  const unread = data.comments.filter((c) => !c.readAt);
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

      <PendingSyncNotice />
      {nudge.data && stats.todayS.logged < stats.todayS.scheduled ? (
        <Notice tone="teacher" icon={<IconBell size={18} />}>
          <span className="font-medium">Your teacher reminded you to log today.</span> Mark each mamool below as you go.
        </Notice>
      ) : (
        <ReminderBanner show={!stats.todayS.hasLog && todays.length > 0} />
      )}
      <LastChanceNotice />
      <NotificationPrompt uid={profile.id} reminderEnabled={profile.reminderEnabled} reminderTime={profile.reminderTime ?? settings.defaultReminderTime} />

      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="section-title mb-0">Today</h2>
          <Link to="/mamoolaat" className="link">
            Edit list
          </Link>
        </div>
        {todays.length ? (
          <Checklist uid={profile.id} day={today} mamoolaat={todays} log={todayLog} editable />
        ) : (
          <EmptyState>No mamoolaat yet. Add your first one below.</EmptyState>
        )}

        {adding ? (
          <div className="card mt-3">
            <h3 className="section-title">Add a mamool</h3>
            <MamoolForm
              submitLabel="Add to my list"
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
          <button
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-[15px] font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700"
            onClick={() => setAdding(true)}
          >
            <IconPlus size={18} />
            Add a mamool
          </button>
        )}
      </section>

      <StatRow>
        <Stat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} sub={`Best ${stats.best}`} />
        <Stat label="This week" value={pct(stats.weekCompletion)} sub="complete" />
        <Stat label="Full days" value={stats.fullDays} sub="this week" />
      </StatRow>

      <section aria-labelledby="home-week">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="home-week" className="section-title mb-0">This week</h2>
          <Link to="/week" className="link">
            Details
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {stats.week.map((d) => {
            const future = d.day > today;
            const locked = !future && !isDayEditable(d.day, today, settings.backfillDays);
            const label = `${formatGregorian(d.day, { year: undefined })}: ${
              future ? 'not yet' : d.scheduled ? `${Math.round(d.completion * 100)}% done` : 'no mamoolaat'
            }${locked ? ', locked' : ''}`;
            const body = (
              <>
              <span className={`text-xs ${d.day === today ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>{shortDay(d.day)}</span>
              <span
                className={`num flex h-10 w-full items-center justify-center rounded-md text-xs font-medium ${
                  d.day > today ? 'border border-dashed border-slate-300 text-slate-300' : cellClass(d.scheduled ? d.completion : null)
                } ${d.day === today ? 'outline-2 outline-offset-2 outline-brand-700' : ''}`}
              >
                {d.day > today ? '' : d.scheduled ? Math.round(d.completion * 100) : '–'}
              </span>
              {locked && <IconLock size={10} className="-mt-1 text-slate-400" aria-hidden />}
              </>
            );
            return future ? (
              <div key={d.day} className="flex flex-col items-center gap-1.5" aria-label={label} role="img">
                {body}
              </div>
            ) : (
              <Link to={`/log/${d.day}`} key={d.day} className="group flex flex-col items-center gap-1.5" aria-label={label}>
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      {(unread.length > 0 || data.unseenChanges > 0) && (
        <section className="rounded-lg border border-gold-400/50 bg-[#fbf6e9]">
          <div className="flex items-baseline justify-between px-4 pt-3.5">
            <h2 className="section-title mb-0 text-[#5b4512]">
              From your teacher <Badge n={unread.length + data.unseenChanges} />
            </h2>
            <Link to="/messages" className="link text-[#5b4512] decoration-gold-400">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-gold-400/30 px-4 pb-1">
            {unread.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <p className="flex-1 whitespace-pre-wrap text-slate-800" dir="auto">
                  {c.text}
                </p>
                <button className="min-h-11 shrink-0 text-sm font-medium text-[#5b4512] underline decoration-gold-400 underline-offset-4" onClick={() => markCommentRead(profile.id, c.id)}>
                  Mark read
                </button>
              </li>
            ))}
            {data.unseenChanges > 0 && (
              <li className="py-3 text-sm text-slate-700">
                Your teacher changed your mamoolaat ({data.unseenChanges} change{data.unseenChanges > 1 ? 's' : ''}).{' '}
                <Link className="font-medium text-[#5b4512] underline decoration-gold-400 underline-offset-4" to="/messages">
                  See what changed
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

    </div>
  );
}
