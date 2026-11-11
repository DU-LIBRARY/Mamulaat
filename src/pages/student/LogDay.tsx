import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { Checklist } from '../../components/Checklist';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Notice, ProgressRing } from '../../components/ui';
import { IconBell, IconPencil } from '../../components/icons';
import { LastChanceNotice, LockedDayNotice, PendingSyncNotice } from '../../components/LockNotices';
import { ReminderBanner } from '../../components/ReminderBanner';
import { Sheet } from '../../components/quiet';
import { MamoolForm } from '../../components/MamoolEditor';
import { useDocData } from '../../hooks/useFirestore';
import { addMamool, nudgeRef } from '../../lib/db';
import type { Nudge } from '../../types';
import { addDays, formatGregorian, isDayEditable, isValidYmd, lastEditableDay, shortDay, dayNumber } from '../../lib/dates';
import { dayStats, scheduledFor } from '../../lib/scoring';

/** The student's main page: today's checklist (or an earlier day still open for filling in). */
export function LogDay() {
  const { profile, today, settings, actor } = useActiveSession();
  const { logs, all } = useMyData();
  const [adding, setAdding] = useState(false);
  const nudge = useDocData<Nudge>(nudgeRef(profile.id, today), `nudge:${profile.id}:${today}`);
  const params = useParams();
  const day = params.day && isValidYmd(params.day) && params.day <= today ? params.day : today;
  const editable = isDayEditable(day, today, settings.backfillDays);
  const mams = scheduledFor(day, all);
  const s = dayStats(day, logs.get(day), all);
  const chips = Array.from({ length: settings.backfillDays + 1 }, (_, i) => addDays(today, -i)).reverse();
  const locksTonight = (d: string) => d !== today && lastEditableDay(d, settings.backfillDays) === today;
  const lastDay = lastEditableDay(day, settings.backfillDays);
  const isToday = day === today;
  const nudged = isToday && !!nudge.data && s.logged < s.scheduled;

  return (
    <div className="flex flex-col gap-4">
      <PendingSyncNotice />
      <nav aria-label="Days you can fill in" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {chips.map((d) => (
          <Link
            key={d}
            to={d === today ? '/' : `/log/${d}`}
            aria-current={d === day ? 'page' : undefined}
            aria-label={`${formatGregorian(d)}${d === today ? ' (today)' : ''}${locksTonight(d) ? ', locks tonight' : ''}`}
            className={`flex min-w-14 flex-col items-center rounded-md border px-3 py-1.5 text-xs font-medium ${
              d === day ? 'border-primary bg-primary text-on-primary' : 'border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
            }`}
          >
            <span>{d === today ? 'Today' : shortDay(d)}</span>
            <span className="num text-lg leading-tight font-semibold">{dayNumber(d)}</span>
            {locksTonight(d) && <span className={`text-[11px] ${d === day ? 'text-on-primary' : 'text-amber-800'}`}>locks tonight</span>}
          </Link>
        ))}
      </nav>

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

      {mams.length ? (
        <Checklist uid={profile.id} day={day} mamoolaat={mams} log={logs.get(day)} editable={editable} />
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
