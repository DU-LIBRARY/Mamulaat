import { Link, useParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { Checklist } from '../../components/Checklist';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Notice, ProgressRing } from '../../components/ui';
import { IconLock, IconPencil } from '../../components/icons';
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
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {chips.map((d) => (
          <Link
            key={d}
            to={`/log/${d}`}
            className={`flex min-w-14 flex-col items-center rounded-md border px-3 py-1.5 text-xs font-medium ${
              d === day ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span>{d === today ? 'Today' : shortDay(d)}</span>
            <span className="num text-lg leading-tight font-semibold">{dayNumber(d)}</span>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <DateLine day={day} size="lg" />
        <ProgressRing value={s.completion} />
      </div>

      {!editable && (
        <Notice icon={<IconLock size={18} />}>This day is locked.</Notice>
      )}

      {logs.get(day)?.editedBy && (
        <Notice tone="teacher" icon={<IconPencil size={18} />}>Your teacher{logs.get(day)?.editedByName ? ` (${logs.get(day)?.editedByName})` : ''} edited this day.</Notice>
      )}

      {mams.length ? (
        <Checklist uid={profile.id} day={day} mamoolaat={mams} log={logs.get(day)} editable={editable} />
      ) : (
        <EmptyState>No mamoolaat were set for this day.</EmptyState>
      )}
      {editable && <p className="text-center text-xs text-slate-500">Saves automatically. Tap again to undo.</p>}
    </div>
  );
}
