/**
 * All "days" in Mamulaat are YYYY-MM-DD strings in the project timezone
 * (settings/app.timezone). Arithmetic on them is done in UTC so it is
 * independent of the device's own timezone.
 */

export const DEFAULT_TIMEZONE = 'UTC';

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date (YYYY-MM-DD) in the given timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const p = parts(now, safeTz(timeZone));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Current local time "HH:MM" in the given timezone. */
export function timeIn(timeZone: string, now: Date = new Date()): string {
  const p = parts(now, safeTz(timeZone));
  return `${p.hour}:${p.minute}`;
}

/** Offset of the timezone from UTC in minutes (e.g. +300 for Asia/Karachi). */
export function utcOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const p = parts(at, safeTz(timeZone));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const atSec = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - atSec) / 60000);
}

function safeTz(tz: string) {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

function toUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)); // noon avoids any edge issues
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  const d = toUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** b - a in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);
}

export function dayOfWeek(ymd: string): number {
  return toUtc(ymd).getUTCDay();
}

/** First day of the week containing `ymd`, with weeks starting on `weekStart` (0=Sun, 1=Mon...). */
export function weekStartOf(ymd: string, weekStart: number): string {
  const offset = (dayOfWeek(ymd) - weekStart + 7) % 7;
  return addDays(ymd, -offset);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;
}

/** Is `day` editable by a student today, given the backfill window? */
export function isDayEditable(day: string, today: string, backfillDays: number): boolean {
  const age = diffDays(day, today);
  return age >= 0 && age <= backfillDays;
}

export function formatGregorian(ymd: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(toUtc(ymd));
}

export function shortDay(ymd: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(toUtc(ymd));
}

export function dayNumber(ymd: string): string {
  return String(toUtc(ymd).getUTCDate());
}

/**
 * Hijri date using the Umm al-Qura calendar from the browser's Intl support.
 * Note: local moon-sighting may differ by a day.
 */
export function formatHijri(ymd: string, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(toUtc(ymd));
  } catch {
    return '';
  }
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The last day on which a student can still change `day` (it locks at the end of this day). */
export function lastEditableDay(day: string, backfillDays: number): string {
  return addDays(day, backfillDays);
}

/** Every day of the calendar month containing `ymd`. */
export function monthDays(ymd: string): string[] {
  const first = `${ymd.slice(0, 7)}-01`;
  const out: string[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatMonth(ymd: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toUtc(ymd));
}

/** Readable "last seen" text, e.g. "today", "yesterday", "5 days ago". */
export function daysAgoLabel(days: number | null): string {
  if (days == null) return 'never';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
