/** Pure helpers for the reminder job (unit-tested in reminders.test.ts). */

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

export function safeTz(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export function localNow(timeZone: string, now = new Date()) {
  const p = parts(now, safeTz(timeZone));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** How long after the chosen time we still send (covers missed runs, avoids very late pings). */
export const SEND_WINDOW_MINUTES = 180;

export function isDue(opts: {
  reminderTime: unknown;
  defaultTime: unknown;
  nowMinutes: number;
  today: string;
  lastReminderDate: unknown;
}): boolean {
  const t = toMinutes(opts.reminderTime) ?? toMinutes(opts.defaultTime) ?? 20 * 60;
  if (opts.lastReminderDate === opts.today) return false;
  const delta = opts.nowMinutes - t;
  return delta >= 0 && delta < SEND_WINDOW_MINUTES;
}

/** A day counts as logged if the log doc has at least one entry, or the admin marked it a day off. */
export function hasLogged(log: { entries?: Record<string, unknown>; off?: unknown } | undefined): boolean {
  if (log?.off === true) return true;
  return !!log && !!log.entries && Object.keys(log.entries).length > 0;
}

/** FCM errors that mean the token is dead and should be deleted. */
export const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface UserSnapshotLike {
  role?: unknown;
  status?: unknown;
  signupComplete?: unknown;
}

/**
 * What a change to users/{uid} should notify, if anything:
 *  - 'admin-signup': a pending student just finished sign-up (name + class) → tell the admin.
 *  - 'student-approved': a student just became active → tell the student.
 */
export function userChangeNotice(before: UserSnapshotLike | undefined, after: UserSnapshotLike | undefined): 'admin-signup' | 'student-approved' | null {
  if (!after) return null;
  if (after.status === 'pending' && after.signupComplete === true && before?.signupComplete !== true) return 'admin-signup';
  if (after.role === 'student' && after.status === 'active' && before?.status !== 'active' && before?.status != null) return 'student-approved';
  return null;
}
