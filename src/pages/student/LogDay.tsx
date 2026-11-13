import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Plus } from '@phosphor-icons/react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { Checklist } from '../../components/Checklist';
import { FridayMamool } from '../../components/FridayMamool';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Notice, ProgressRing } from '../../components/ui';
import { IconBell, IconPencil } from '../../components/icons';
import { LastChanceNotice, LockedDayNotice, PendingSyncNotice, LostEntriesNotice } from '../../components/LockNotices';
import { ReminderBanner } from '../../components/ReminderBanner';
import { Cta, Sheet } from '../../components/quiet';
import { useUndo } from '../../components/Undo';
import { MamoolForm } from '../../components/MamoolEditor';
import { useDocData } from '../../hooks/useFirestore';
import { addMamool, nudgeRef, restoreEntries, saveEntries } from '../../lib/db';
import type { LogEntry, Nudge } from '../../types';
import { isDayEditable, isValidYmd, lastEditableDay } from '../../lib/dates';
import { DayChips } from '../../components/DayChips';
import { dayStats, scheduledFor } from '../../lib/scoring';

/** The student's main page: today's checklist (or an earlier day still open for filling in). */
export function LogDay() {
  const { profile, today, settings, actor } = useActiveSession();
  const { logs, all } = useMyData();
  const [adding, setAdding] = useState(false);
  const undo = useUndo();
  const nudge = useDocData<Nudge>(nudgeRef(profile.id, today), `nudge:${profile.id}:${today}`);
  const params = useParams();
  const day = params.day && isValidYmd(params.day) && params.day <= today ? params.day : today;
  const editable = isDayEditable(day, today, settings.backfillDays);
  const mams = scheduledFor(day, all);
  const s = dayStats(day, logs.get(day), all);
  const lastDay = lastEditableDay(day, settings.backfillDays);
  const isToday = day === today;
  const nudged = isToday && !!nudge.data && s.logged < s.scheduled;
  // Fill in only what's still empty; anything already marked (done, partly, missed) is kept.
  const remaining = mams.filter((m) => !logs.get(day)?.entries?.[m.id]);
  const markRest = () => {
    const next: Record<string, LogEntry> = {};
    const prev: Record<string, LogEntry | undefined> = {};
    for (const m of remaining) {
      next[m.id] = { status: 'done', amount: m.target, target: m.target };
      prev[m.id] = undefined;
    }
    saveEntries(profile.id, day, next);
    undo.undoable(`Marked ${remaining.length} done`, () => restoreEntries(profile.id, day, prev));
  };

  return (
    <div className="flex flex-col gap-4">
      <LostEntriesNotice />
      <PendingSyncNotice />
      <DayChips day={day} today={today} backfillDays={settings.backfillDays} hrefFor={(d) => (d === today ? '/' : `/log/${d}`)} />

      <div className="flex items-center justify-between">
        <DateLine day={day} size="lg" />
        <ProgressRing value={s.completion} />
      </div>

      {nudged ? (
        <Notice tone="teacher" icon={<IconBell size={18} />}>
          <span className="font-medium">Your teacher reminded you to log today.</span> Mark each mamool as you go.
        </Notice>
      ) : (
        <ReminderBanner show={isToday && !s.hasLog && mams.length > 0} />
      )}
      {isToday && <LastChanceNotice />}
      <LockedDayNotice day={day} />
      {editable && day !== today && lastDay === today && (
        <Notice tone="warn">Last chance: this day locks at midnight tonight.</Notice>
      )}

      {logs.get(day)?.editedBy && (
        <Notice tone="teacher" icon={<IconPencil size={18} />}>Your teacher{logs.get(day)?.editedByName ? ` (${logs.get(day)?.editedByName})` : ''} edited this day.</Notice>
      )}

      {editable && remaining.length > 0 && (
        <Cta icon={Check} onClick={markRest}>
          {remaining.length === mams.length ? 'Mark all done' : `Mark the other ${remaining.length} done`}
        </Cta>
      )}

      <FridayMamool uid={profile.id} day={day} log={logs.get(day)} editable={editable} />

      {mams.length ? (
        <Checklist uid={profile.id} day={day} mamoolaat={mams} log={logs.get(day)} editable={editable} hideMarkRest />
      ) : (
        <EmptyState>{isToday ? 'Add the mamoolaat you keep each day, and tick them off as you go.' : 'No mamoolaat were set for this day.'}</EmptyState>
      )}
      {isToday && (
        <div className="flex items-center justify-between">
          <button className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-[15px] text-brand-700 hover:text-brand-900" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden />
            {mams.length ? 'Add a mamool' : 'Add your first mamool'}
          </button>
          {mams.length > 0 && (
            <Link to="/mamoolaat" className="link">
              Edit list
            </Link>
          )}
        </div>
      )}
      {editable && mams.length > 0 && <p className="text-center text-xs text-slate-500">Saves automatically. Tap again to undo.</p>}

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
