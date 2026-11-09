import type { DayLog, LogEntry, Mamool } from '../types';
import { addDays, diffDays } from './dates';

/** A day keeps the streak alive if overall completion is at least this. */
export const STREAK_MIN_COMPLETION = 0.5;

/** Mamoolaat that count for a given day (added on/before it and not yet removed). */
export function scheduledFor(day: string, mamoolaat: Mamool[]): Mamool[] {
  return mamoolaat.filter(
    (m) =>
      m.createdDate <= day &&
      (m.removedDate == null || m.removedDate > day) &&
      (m.active || m.removedDate != null) &&
      // days it was removed and later restored do not count against the student
      !(m.gaps ?? []).some((g) => g.from <= day && day < g.to),
  );
}

/** The admin took this day off the record: it doesn't count for anything. */
export function isOffDay(log: DayLog | undefined): boolean {
  return log?.off === true;
}

/** Mamoolaat that count on a day, given that day's log (none on a day off). */
export function countingFor(day: string, log: DayLog | undefined, mamoolaat: Mamool[]): Mamool[] {
  return isOffDay(log) ? [] : scheduledFor(day, mamoolaat);
}

export function entryFraction(e: LogEntry | undefined): number {
  if (!e) return 0;
  if (e.status === 'done') return 1;
  if (e.status === 'missed') return 0;
  const target = e.target > 0 ? e.target : 1;
  return Math.max(0, Math.min(1, e.amount / target));
}

export interface DayStats {
  day: string;
  scheduled: number;
  logged: number; // entries with any status
  done: number;
  completion: number; // 0..1
  hasLog: boolean;
  /** Day off (excused): nothing scheduled, nothing counts. */
  off: boolean;
}

export function dayStats(day: string, log: DayLog | undefined, mamoolaat: Mamool[]): DayStats {
  const off = isOffDay(log);
  const sched = countingFor(day, log, mamoolaat);
  const entries = log?.entries ?? {};
  let sum = 0;
  let done = 0;
  let logged = 0;
  for (const m of sched) {
    const e = entries[m.id];
    if (e) logged++;
    const f = entryFraction(e);
    sum += f;
    if (f >= 1) done++;
  }
  const completion = sched.length ? sum / sched.length : 0;
  return { day, scheduled: sched.length, logged, done, completion, hasLog: logged > 0, off };
}

export function logsByDay(logs: DayLog[]): Map<string, DayLog> {
  return new Map(logs.map((l) => [l.id, l]));
}

/**
 * Current streak: consecutive days with completion >= STREAK_MIN_COMPLETION,
 * ending today (or yesterday, if today isn't done yet — so the streak isn't
 * "lost" in the morning).
 */
export function currentStreak(today: string, logs: Map<string, DayLog>, mamoolaat: Mamool[]): number {
  const ok = (d: string) => {
    const s = dayStats(d, logs.get(d), mamoolaat);
    return s.scheduled > 0 && s.completion >= STREAK_MIN_COMPLETION;
  };
  const off = (d: string) => isOffDay(logs.get(d));
  let day = ok(today) || off(today) ? today : addDays(today, -1);
  let streak = 0;
  // Days off are skipped: they neither add to nor break the streak.
  // cap the walk to avoid pathological loops
  for (let i = 0; i < 3660; i++) {
    if (off(day)) {
      day = addDays(day, -1);
      continue;
    }
    if (!ok(day)) break;
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(today: string, logs: Map<string, DayLog>, mamoolaat: Mamool[]): number {
  const days = [...logs.keys()].sort();
  if (!days.length) return 0;
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (d > today) continue;
    if (isOffDay(logs.get(d))) continue; // a day off neither counts nor breaks the run
    const s = dayStats(d, logs.get(d), mamoolaat);
    const good = s.scheduled > 0 && s.completion >= STREAK_MIN_COMPLETION;
    if (!good) {
      run = 0;
    } else {
      run = prev && run > 0 && onlyOffBetween(prev, d, logs) ? run + 1 : 1;
      best = Math.max(best, run);
    }
    prev = d;
  }
  return best;
}

/** True if `a` and `b` are consecutive, or every day strictly between them is a day off. */
function onlyOffBetween(a: string, b: string, logs: Map<string, DayLog>): boolean {
  const gap = diffDays(a, b);
  if (gap < 1 || gap > 3660) return false;
  for (let i = 1; i < gap; i++) if (!isOffDay(logs.get(addDays(a, i)))) return false;
  return true;
}

/**
 * Today only counts once something has been logged for it: an empty (or cleared) today
 * is "not yet", not 0%. Past days with nothing logged still count as 0.
 */
export function pendingToday(day: string, upTo: string, log: DayLog | undefined, mamoolaat: Mamool[]): boolean {
  return day === upTo && !dayStats(day, log, mamoolaat).hasLog;
}

/** Per-mamool completion over a set of days (only days where the mamool was scheduled). */
export function mamoolCompletion(m: Mamool, days: string[], logs: Map<string, DayLog>, upTo: string, mamoolaat: Mamool[] = [m]) {
  let sum = 0;
  let n = 0;
  for (const d of days) {
    if (d > upTo) continue;
    if (countingFor(d, logs.get(d), [m]).length === 0) continue;
    if (pendingToday(d, upTo, logs.get(d), mamoolaat)) continue;
    n++;
    sum += entryFraction(logs.get(d)?.entries[m.id]);
  }
  return n ? sum / n : null;
}

/** Overall completion across days up to `upTo` (average of day completions where something was scheduled). */
export function periodCompletion(days: string[], logs: Map<string, DayLog>, mamoolaat: Mamool[], upTo: string) {
  let sum = 0;
  let n = 0;
  for (const d of days) {
    if (d > upTo) continue;
    const s = dayStats(d, logs.get(d), mamoolaat);
    if (!s.scheduled) continue;
    if (d === upTo && !s.hasLog) continue; // today, nothing logged yet
    n++;
    sum += s.completion;
  }
  return n ? sum / n : null;
}

export function pct(f: number | null | undefined): string {
  return f == null ? '–' : `${Math.round(f * 100)}%`;
}
