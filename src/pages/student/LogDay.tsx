import { Link, useParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { Checklist } from '../../components/Checklist';
import { DateLine } from '../../components/DateLine';
import { EmptyState, ProgressRing } from '../../components/ui';
import { addDays, isDayEditable, isValidYmd, shortDay, dayNumber } from '../../lib/dates';
import { dayStats, scheduledFor } from '../../lib/scoring';

export function LogDay() {
  const { profile, today, settings } = useActiveSession();
  const { logs, all } = useMyData();
  const params = useParams();
  const day = params.day && isValidYmd(params.day) && params.day <= today ? params.day : today;
  const editable = isDayEditable(day, today, settings.backfillDays);
  const mams = scheduledFor(day, all);
  const s = dayStats(day, logs.get(day), all);
  const chips = Array.from({ length: settings.backfillDays + 1 }, (_, i) => addDays(today, -i)).reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((d) => (
          <Link
            key={d}
            to={`/log/${d}`}
            className={`flex min-w-16 flex-col items-center rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
              d === day ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-200'
            }`}
          >
            <span>{d === today ? 'Today' : shortDay(d)}</span>
            <span className="text-lg">{dayNumber(d)}</span>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <DateLine day={day} />
        <ProgressRing value={s.completion} />
      </div>

      {!editable && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
          🔒 This day is locked. You can fill in up to {settings.backfillDays} day{settings.backfillDays === 1 ? '' : 's'} back.
        </div>
      )}
      {editable && day !== today && (
        <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">You're filling in a past day. It locks after {settings.backfillDays} day{settings.backfillDays === 1 ? '' : 's'}.</div>
      )}

      {logs.get(day)?.editedBy && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">✎ Your teacher{logs.get(day)?.editedByName ? ` (${logs.get(day)?.editedByName})` : ''} edited this day. Your next change here removes this note.</div>
      )}

      {mams.length ? (
        <Checklist uid={profile.id} day={day} mamoolaat={mams} log={logs.get(day)} editable={editable} />
      ) : (
        <EmptyState>No mamoolaat were set for this day.</EmptyState>
      )}
      <p className="text-center text-xs text-slate-400">Tap a choice again to clear it. Changes save instantly, even offline.</p>
    </div>
  );
}
