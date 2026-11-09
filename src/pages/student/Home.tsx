import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Check, Plus } from '@phosphor-icons/react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { Checklist, targetLabel } from '../../components/Checklist';
import { ReminderBanner } from '../../components/ReminderBanner';
import { Spinner, Badge, cellClass, EmptyState, Notice, SegmentBar, StatRow, Stat } from '../../components/ui';
import { Cta, Disclosure, Hero, Row, Rows, Sheet } from '../../components/quiet';
import { IconBell, IconLock } from '../../components/icons';
import { LastChanceNotice, PendingSyncNotice } from '../../components/LockNotices';
import { useDocData } from '../../hooks/useFirestore';
import { useUndo } from '../../components/Undo';
import { currentStreak, bestStreak, dayStats, scheduledFor, periodCompletion, pct, entryFraction } from '../../lib/scoring';
import { formatGregorian, formatHijri, isDayEditable, shortDay, weekDays, weekStartOf } from '../../lib/dates';
import { addMamool, nudgeRef, saveEntry } from '../../lib/db';
import type { Nudge } from '../../types';
import { MamoolForm } from '../../components/MamoolEditor';

/**
 * Today, built like the Bilal app: one big answer (the next mamool to do) with one
 * action, then everything else as quiet rows that expand in place or open elsewhere.
 */
export function Home() {
  const { profile, today, settings, actor } = useActiveSession();
  const data = useMyData();
  const undo = useUndo();
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
  const hijri = formatHijri(today);
  // The next one to do: the first not yet logged, else the first only partly done.
  const next = todays.find((m) => !todayLog?.entries?.[m.id]) ?? todays.find((m) => todayLog?.entries?.[m.id]?.status === 'partial');
  const markNextDone = () => {
    if (!next) return;
    const prev = todayLog?.entries?.[next.id] ?? null;
    saveEntry(profile.id, today, next.id, { status: 'done', amount: next.target, target: next.target });
    undo.undoable(`Marked “${next.name}” done`, () => saveEntry(profile.id, today, next.id, prev));
  };
  const streakText = `${stats.streak}-day streak`;

  return (
    <div className="flex flex-col gap-7">
      <header className="pt-5">
        <div className="text-[15px] text-slate-900" dir="auto">
          Assalamu alaykum{first ? `, ${first}` : ''}
        </div>
        <div className="mt-0.5 text-[13px] text-slate-500">
          {formatGregorian(today, { weekday: 'long', month: 'long', year: undefined })}
          {hijri ? ` · ${hijri}` : ''}
        </div>

        {todays.length === 0 ? (
          <Hero className="mt-9" label="Today" sub="Add the mamoolaat you keep each day, and tick them off as you go.">
            Nothing set up yet
          </Hero>
        ) : next ? (
          <Hero
            className="mt-9"
            label="Next up"
            sub={
              <span className="num">
                {targetLabel(next)} · {stats.todayS.done} of {stats.todayS.scheduled} done today
              </span>
            }
          >
            <span className="line-clamp-2">{next.name}</span>
          </Hero>
        ) : (
          <Hero className="mt-9" label="Today" sub={<span className="num">{stats.todayS.done} of {stats.todayS.scheduled} done · {streakText}</span>}>
            All logged for today.
          </Hero>
        )}

        {todays.length > 0 && <SegmentBar className="mt-6" fractions={todays.map((m) => entryFraction(todayLog?.entries?.[m.id]))} />}

        <div className="mt-6">
          {todays.length === 0 ? (
            <Cta icon={Plus} onClick={() => setAdding(true)}>
              Add your first mamool
            </Cta>
          ) : next ? (
            <Cta icon={Check} onClick={markNextDone}>
              Mark done
            </Cta>
          ) : null}
        </div>
      </header>

      {(nudge.data && stats.todayS.logged < stats.todayS.scheduled) || !stats.todayS.hasLog ? (
        <div className="flex flex-col gap-3">
          {nudge.data && stats.todayS.logged < stats.todayS.scheduled ? (
            <Notice tone="teacher" icon={<IconBell size={18} />}>
              <span className="font-medium">Your teacher reminded you to log today.</span> Mark each mamool as you go.
            </Notice>
          ) : (
            <ReminderBanner show={!stats.todayS.hasLog && todays.length > 0} />
          )}
        </div>
      ) : null}
      <PendingSyncNotice />
      <LastChanceNotice />

      <Rows>
        <Disclosure
          title="Today’s mamoolaat"
          sub={todays.length ? <span className="num">{stats.todayS.done} of {stats.todayS.scheduled} done</span> : 'None yet'}
          defaultOpen
        >
          {todays.length ? (
            <Checklist uid={profile.id} day={today} mamoolaat={todays} log={todayLog} editable />
          ) : (
            <EmptyState>No mamoolaat yet.</EmptyState>
          )}
          <div className="mt-3 flex items-center justify-between">
            <button className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-[15px] text-brand-700 hover:text-brand-900" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden />
              Add a mamool
            </button>
            <Link to="/mamoolaat" className="link">
              Edit list
            </Link>
          </div>
        </Disclosure>

        <Disclosure title="This week" sub={<span className="num">{streakText} · {pct(stats.weekCompletion)} complete</span>}>
          <StatRow className="mb-5 border-t-0">
            <Stat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} sub={`Best ${stats.best}`} />
            <Stat label="This week" value={pct(stats.weekCompletion)} sub="complete" />
            <Stat label="Full days" value={stats.fullDays} sub="this week" />
          </StatRow>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {stats.week.map((d) => {
            const future = d.day > today;
            const locked = !future && !isDayEditable(d.day, today, settings.backfillDays);
            const label = `${formatGregorian(d.day, { year: undefined })}: ${
              future ? 'not yet' : d.scheduled ? `${Math.round(d.completion * 100)}% done` : 'no mamoolaat'
            }${locked ? ', locked' : ''}`;
            const body = (
              <>
              <span className={`text-xs ${d.day === today ? 'text-slate-900' : 'text-slate-500'}`}>{shortDay(d.day)}</span>
              <span
                className={`num flex h-10 w-full items-center justify-center rounded-md text-xs font-medium ${
                  d.day > today ? 'border border-slate-200 text-slate-300' : cellClass(d.scheduled ? d.completion : null)
                } ${d.day === today ? 'outline-1 outline-offset-2 outline-slate-900' : ''}`}
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
          <Link to="/week" className="link mt-4 inline-block">
            Week details
          </Link>
        </Disclosure>

        {(unread.length > 0 || data.unseenChanges > 0) && (
          <Row
            to="/messages"
            sub={unread[0]?.text ?? `Your teacher changed your mamoolaat (${data.unseenChanges})`}
            end={<Badge n={unread.length + data.unseenChanges} />}
          >
            From your teacher
          </Row>
        )}
        <Row to="/log" sub="Fill in or check an earlier day">
          Another day
        </Row>
      </Rows>

      <Sheet open={adding} onOpenChange={setAdding} title="Add a mamool">
        <MamoolForm
          submitLabel="Add to my list"
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            const order = all.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);
            addMamool(profile.id, v, order, today, actor);
            setAdding(false);
          }}
        />
        <p className="mt-3 text-[13px] text-slate-500">It appears on today’s list straight away. Past days are not changed.</p>
      </Sheet>
    </div>
  );
}
