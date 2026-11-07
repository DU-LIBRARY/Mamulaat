import type { DayLog, LogEntry, Mamool } from '../types';
import { addDays, diffDays } from './dates';

/** Points for a fully done mamool. Partial gets a proportional share. */
export const POINTS_PER_MAMOOL = 10;
/** Bonus for completing every mamool on a day. */
export const FULL_DAY_BONUS = 5;
/** A day keeps the streak alive if overall completion is at least this. */
export const STREAK_MIN_COMPLETION = 0.5;

/** Mamoolaat that count for a given day (added on/before it and not yet removed). */
export function scheduledFor(day: string, mamoolaat: Mamool[]): Mamool[] {
  return mamoolaat.filter(
    (m) => m.createdDate <= day && (m.removedDate == null || m.removedDate > day) && (m.active || m.removedDate != null),
  );
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
  points: number;
  hasLog: boolean;
}

export function dayStats(day: string, log: DayLog | undefined, mamoolaat: Mamool[]): DayStats {
  const sched = scheduledFor(day, mamoolaat);
  const entries = log?.entries ?? {};
  let sum = 0;
  let done = 0;
  let logged = 0;
  let points = 0;
  for (const m of sched) {
    const e = entries[m.id];
    if (e) logged++;
    const f = entryFraction(e);
    sum += f;
    if (f >= 1) done++;
    points += Math.round(POINTS_PER_MAMOOL * f);
  }
  const completion = sched.length ? sum / sched.length : 0;
  if (sched.length && done === sched.length) points += FULL_DAY_BONUS;
  return { day, scheduled: sched.length, logged, done, completion, points, hasLog: logged > 0 };
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
  let day = ok(today) ? today : addDays(today, -1);
  let streak = 0;
  // cap the walk to avoid pathological loops
  for (let i = 0; i < 3660 && ok(day); i++) {
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
    const s = dayStats(d, logs.get(d), mamoolaat);
    const good = s.scheduled > 0 && s.completion >= STREAK_MIN_COMPLETION;
    if (!good) {
      run = 0;
    } else {
      run = prev && diffDays(prev, d) === 1 && run > 0 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    prev = d;
  }
  return best;
}

export function totalPoints(logs: Map<string, DayLog>, mamoolaat: Mamool[]): number {
  let t = 0;
  for (const [d, l] of logs) t += dayStats(d, l, mamoolaat).points;
  return t;
}

/** Per-mamool completion over a set of days (only days where the mamool was scheduled). */
export function mamoolCompletion(m: Mamool, days: string[], logs: Map<string, DayLog>, upTo: string) {
  let sum = 0;
  let n = 0;
  for (const d of days) {
    if (d > upTo) continue;
    if (scheduledFor(d, [m]).length === 0) continue;
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
    n++;
    sum += s.completion;
  }
  return n ? sum / n : null;
}

export function pct(f: number | null | undefined): string {
  return f == null ? '–' : `${Math.round(f * 100)}%`;
}
