import type { DayLog, Mamool, UserProfile } from '../types';
import { addDays, diffDays } from './dates';
import { dayStats, entryFraction, mamoolCompletion, periodCompletion, scheduledFor } from './scoring';

export interface StudentWeek {
  student: UserProfile;
  days: { day: string; completion: number | null; hasLog: boolean }[];
  completion: number | null;
  fullDays: number;
  perMamool: { mamool: Mamool; cells: (number | null)[]; logged: boolean[]; completion: number | null }[];
}

export function studentWeek(student: UserProfile, days: string[], mamoolaat: Mamool[], logs: Map<string, DayLog>, today: string): StudentWeek {
  const ds = days.map((d) => {
    if (d > today) return { day: d, completion: null, hasLog: false };
    const s = dayStats(d, logs.get(d), mamoolaat);
    return { day: d, completion: s.scheduled ? s.completion : null, hasLog: s.hasLog };
  });
  const inWeek = mamoolaat.filter((m) => days.some((d) => scheduledFor(d, [m]).length));
  return {
    student,
    days: ds,
    completion: periodCompletion(days, logs, mamoolaat, today),
    fullDays: ds.filter((d) => d.completion === 1).length,
    perMamool: inWeek.map((m) => ({
      mamool: m,
      cells: days.map((d) => (d <= today && scheduledFor(d, [m]).length ? entryFraction(logs.get(d)?.entries[m.id]) : null)),
      logged: days.map((d) => !!logs.get(d)?.entries?.[m.id]),
      completion: mamoolCompletion(m, days, logs, today, mamoolaat),
    })),
  };
}

export interface AttentionItem {
  student: UserProfile;
  reasons: string[];
  completion: number | null;
  daysSinceLog: number | null; // null = no log in the loaded range
}

/**
 * "Needs attention": weekly completion below the threshold, or no logs for
 * `noLogDays` days (today included). `logs` must cover at least the last `noLogDays` days.
 */
export function needsAttention(
  student: UserProfile,
  weekDaysList: string[],
  mamoolaat: Mamool[],
  logs: Map<string, DayLog>,
  today: string,
  thresholdPct: number,
  noLogDays: number,
): AttentionItem | null {
  const reasons: string[] = [];
  const completion = periodCompletion(weekDaysList, logs, mamoolaat, today);
  if (mamoolaat.filter((m) => m.active).length === 0) reasons.push('No mamoolaat set up');
  else if (completion != null && completion * 100 < thresholdPct) reasons.push(`Week completion ${Math.round(completion * 100)}% (< ${thresholdPct}%)`);

  let last: string | null = null;
  for (const [d, l] of logs) {
    if (d <= today && dayStats(d, l, mamoolaat).hasLog && (!last || d > last)) last = d;
  }
  const since = last ? diffDays(last, today) : null;
  const windowStart = addDays(today, -(noLogDays - 1));
  if (!last || last < windowStart) reasons.push(last ? `No logs for ${since} days` : `No logs in the last ${noLogDays} days`);
  return reasons.length ? { student, reasons, completion, daysSinceLog: since } : null;
}
