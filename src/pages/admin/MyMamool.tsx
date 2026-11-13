import { useMemo } from 'react';
import { Check } from '@phosphor-icons/react';
import { useActiveSession } from '../../hooks/useSession';
import { useStudentLive } from '../../hooks/useStudentData';
import { Checklist, targetLabel } from '../../components/Checklist';
import { FridayMamool } from '../../components/FridayMamool';
import { MamoolEditor } from '../../components/MamoolEditor';
import { EmptyState, SegmentBar, Spinner, Stat, StatRow } from '../../components/ui';
import { Cta, Disclosure, Hero, Rows } from '../../components/quiet';
import { useUndo } from '../../components/Undo';
import { currentStreak, dayStats, entryFraction, pct, periodCompletion, scheduledFor } from '../../lib/scoring';
import { formatGregorian, formatHijri, weekDays, weekStartOf } from '../../lib/dates';
import { saveEntry } from '../../lib/db';

/**
 * The admin's landing page: their own mamool, laid out like the student's Today —
 * the next one to do and one action, then quiet rows for the list, the week and editing.
 */
export function MyMamool() {
  const { profile, today, settings, actor } = useActiveSession();
  const data = useStudentLive(profile.id);
  const undo = useUndo();
  const { logs, all } = data;
  const empty = !data.loading && all.length === 0;

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
  const hijri = formatHijri(today);
  const next = todays.find((m) => !todayLog?.entries?.[m.id]) ?? todays.find((m) => todayLog?.entries?.[m.id]?.status === 'partial');
  const markNextDone = () => {
    if (!next) return;
    const prev = todayLog?.entries?.[next.id] ?? null;
    saveEntry(profile.id, today, next.id, { status: 'done', amount: next.target, target: next.target }, actor);
    undo.undoable(`Marked “${next.name}” done`, () => saveEntry(profile.id, today, next.id, prev, actor));
  };

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
          <Hero className="mt-9" label="My mamool" sub={all.length ? 'Nothing is set for today.' : 'Add your own mamool below to keep track of it here.'}>
            {all.length ? 'A free day' : 'Nothing set up yet'}
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
          <Hero className="mt-9" label="Today" sub={<span className="num">{stats.todayS.done} of {stats.todayS.scheduled} done · {stats.streak}-day streak</span>}>
            All logged for today.
          </Hero>
        )}
        {todays.length > 0 && <SegmentBar className="mt-6" fractions={todays.map((m) => entryFraction(todayLog?.entries?.[m.id]))} />}
        {next && (
          <div className="mt-6">
            <Cta icon={Check} onClick={markNextDone}>
              Mark done
            </Cta>
          </div>
        )}
      </header>

      <FridayMamool uid={profile.id} day={today} log={todayLog} editable self={actor} />

      <Rows>
        <Disclosure title="My mamool today" sub={todays.length ? <span className="num">{stats.todayS.done} of {stats.todayS.scheduled} done</span> : 'Nothing today'} defaultOpen={todays.length > 0}>
          {todays.length ? (
            <Checklist uid={profile.id} day={today} mamoolaat={todays} log={todayLog} editable self={actor} compact />
          ) : (
            <EmptyState>{all.length ? 'Nothing is set for today.' : 'You have no mamool yet.'}</EmptyState>
          )}
        </Disclosure>
        {todays.length > 0 && (
          <Disclosure title="This week" sub={<span className="num">{stats.streak}-day streak · {pct(stats.week)} complete</span>}>
            <StatRow className="border-t-0">
              <Stat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
              <Stat label="This week" value={pct(stats.week)} sub="complete" />
              <Stat label="Today" value={pct(stats.todayS.completion)} sub="complete" />
            </StatRow>
          </Disclosure>
        )}
        <Disclosure title="Add or edit my mamool" sub="Changes apply from today. Past days keep their history." defaultOpen={empty}>
          <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
        </Disclosure>
      </Rows>
    </div>
  );
}
