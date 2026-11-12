import { Link } from 'react-router-dom';
import { useActiveSession } from '../hooks/useSession';
import { useMyData } from '../hooks/useStudentData';
import { useSyncState } from '../lib/sync';
import { dismissLost, useUnsynced } from '../lib/unsynced';
import { addDays, formatGregorian, isDayEditable, lastEditableDay } from '../lib/dates';
import { dayStats } from '../lib/scoring';
import { Notice } from './ui';
import { IconClock, IconLock } from './icons';

const dayName = (d: string) => formatGregorian(d, { year: undefined });

/**
 * Offline safety net. A log saved offline is only checked by the server when it syncs,
 * and is rejected if its day has locked by then. Warn while there is still time.
 */
export function PendingSyncNotice() {
  const { today, settings } = useActiveSession();
  const { pendingDays } = useMyData();
  const { online } = useSyncState();
  if (!pendingDays.length) return null;

  const days = [...pendingDays].sort();
  const lost = days.filter((d) => lastEditableDay(d, settings.backfillDays) < today);
  const urgent = days.filter((d) => lastEditableDay(d, settings.backfillDays) === today);

  if (lost.length) {
    return (
      <Notice tone="warn" icon={<IconLock size={18} />}>
        <span className="font-medium">Not saved: {lost.map(dayName).join(', ')}.</span> {lost.length === 1 ? 'This log' : 'These logs'} stayed on this device until after the day locked, so the
        server can't accept {lost.length === 1 ? 'it' : 'them'}. Please tell your teacher what you did that day — they can fill it in for you.
      </Notice>
    );
  }
  if (urgent.length) {
    return (
      <Notice tone="warn" icon={<IconClock size={18} />}>
        <span className="font-medium">Connect to the internet before midnight.</span> Your log for {urgent.map(dayName).join(', ')} is only saved on this device, and that day locks
        tonight.
      </Notice>
    );
  }
  if (!online) {
    const by = lastEditableDay(days[0], settings.backfillDays);
    return (
      <Notice icon={<IconClock size={18} />}>
        You're offline. Your changes are saved on this device and will upload when you reconnect — please get online by the end of {by === addDays(today, 1) ? 'tomorrow' : dayName(by)}.
      </Notice>
    );
  }
  return null;
}

/**
 * After the fact: entries that reached the server too late were refused, and this phone's copy
 * of them has reverted. Say which days, so the student can tell their teacher. Stays until dismissed.
 */
export function LostEntriesNotice() {
  const { profile } = useActiveSession();
  const { lost } = useUnsynced(profile.id);
  if (!lost.length) return null;
  const days = [...new Set(lost.map((l) => l.day))].sort();
  const what = (d: string) => {
    const kinds = lost.filter((l) => l.day === d).map((l) => (l.kind === 'salah' ? 'salah' : 'mamoolaat'));
    return `${dayName(d)} (${[...new Set(kinds)].join(' and ')})`;
  };
  return (
    <Notice
      tone="warn"
      icon={<IconLock size={18} />}
      action={
        <button type="button" className="text-sm font-medium underline decoration-amber-400 underline-offset-4" onClick={() => dismissLost(profile.id)}>
          OK
        </button>
      }
    >
      <span className="font-medium">Not saved: {days.map(what).join(', ')}.</span> What you entered reached the server after {days.length === 1 ? 'that day' : 'those days'} had locked, so it
      was not kept. Please tell your teacher what you did — they can fill it in for you.
    </Notice>
  );
}

/** "Yesterday locks tonight": a gentle push to fill in the oldest day that can still be changed. */
export function LastChanceNotice() {
  const { today, settings } = useActiveSession();
  const { logs, all } = useMyData();
  if (settings.backfillDays < 1) return null;
  const oldest = addDays(today, -settings.backfillDays);
  const s = dayStats(oldest, logs.get(oldest), all);
  if (!s.scheduled || s.logged >= s.scheduled) return null;
  const missing = s.scheduled - s.logged;
  return (
    <Notice
      tone="warn"
      icon={<IconClock size={18} />}
      action={
        <Link to={`/log/${oldest}`} className="text-sm font-medium underline decoration-amber-400 underline-offset-4">
          Fill in
        </Link>
      }
    >
      <span className="font-medium">{dayName(oldest)} locks tonight.</span> {missing} mamool{missing === 1 ? ' is' : 'aat are'} not filled in yet.
    </Notice>
  );
}

/** Explains a locked day and what to do about it. */
export function LockedDayNotice({ day }: { day: string }) {
  const { today, settings } = useActiveSession();
  if (isDayEditable(day, today, settings.backfillDays)) return null;
  return (
    <Notice icon={<IconLock size={18} />}>
      <span className="font-medium">This day is locked.</span> If something here is wrong, ask your teacher — they can correct it.
    </Notice>
  );
}
