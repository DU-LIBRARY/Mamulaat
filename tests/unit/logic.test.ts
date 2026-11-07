import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isDayEditable, todayIn, utcOffsetMinutes, weekStartOf, formatHijri } from '../../src/lib/dates';
import { currentStreak, dayStats, logsByDay, scheduledFor } from '../../src/lib/scoring';
import { needsAttention } from '../../src/lib/reports';
import { toCsv } from '../../src/lib/csv';
import type { DayLog, Mamool, UserProfile } from '../../src/types';

const m = (id: string, createdDate: string, extra: Partial<Mamool> = {}): Mamool => ({
  id, name: id, target: 10, unit: 'x', active: true, order: 0, createdBy: 'u', createdDate,
  removedDate: null, updatedBy: 'u', ...extra,
});
const log = (day: string, entries: DayLog['entries']): DayLog => ({ id: day, date: day, entries });

describe('dates', () => {
  it('does day arithmetic', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(diffDays('2026-11-01', '2026-11-07')).toBe(6);
    expect(weekStartOf('2026-11-07', 1)).toBe('2026-11-02'); // Saturday -> Monday
    expect(weekStartOf('2026-11-08', 1)).toBe('2026-11-02'); // Sunday
    expect(weekStartOf('2026-11-08', 0)).toBe('2026-11-08');
  });
  it('computes today in a timezone', () => {
    const t = new Date('2026-11-07T22:30:00Z');
    expect(todayIn('UTC', t)).toBe('2026-11-07');
    expect(todayIn('Asia/Karachi', t)).toBe('2026-11-08');
    expect(todayIn('America/New_York', t)).toBe('2026-11-07');
    expect(utcOffsetMinutes('Asia/Karachi', t)).toBe(300);
    expect(utcOffsetMinutes('America/New_York', t)).toBe(-300);
  });
  it('locks days outside the backfill window', () => {
    expect(isDayEditable('2026-11-07', '2026-11-07', 2)).toBe(true);
    expect(isDayEditable('2026-11-05', '2026-11-07', 2)).toBe(true);
    expect(isDayEditable('2026-11-04', '2026-11-07', 2)).toBe(false);
    expect(isDayEditable('2026-11-08', '2026-11-07', 2)).toBe(false);
  });
  it('formats hijri', () => {
    expect(formatHijri('2026-11-07')).toMatch(/1448/);
  });
});

describe('scoring', () => {
  const ms = [m('a', '2026-11-01'), m('b', '2026-11-05'), m('c', '2026-11-01', { active: false, removedDate: '2026-11-03' })];
  it('schedules by created/removed date', () => {
    expect(scheduledFor('2026-11-02', ms).map((x) => x.id)).toEqual(['a', 'c']);
    expect(scheduledFor('2026-11-06', ms).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('computes completion and points', () => {
    const s = dayStats('2026-11-06', log('2026-11-06', {
      a: { status: 'done', amount: 10, target: 10 },
      b: { status: 'partial', amount: 5, target: 10 },
    }), ms);
    expect(s.completion).toBeCloseTo(0.75);
    expect(s.points).toBe(15);
    const full = dayStats('2026-11-06', log('2026-11-06', {
      a: { status: 'done', amount: 10, target: 10 }, b: { status: 'done', amount: 10, target: 10 },
    }), ms);
    expect(full.points).toBe(25);
  });
  it('computes streaks', () => {
    const logs = logsByDay([
      log('2026-11-04', { a: { status: 'done', amount: 10, target: 10 } }),
      log('2026-11-05', { a: { status: 'done', amount: 10, target: 10 }, b: { status: 'missed', amount: 0, target: 10 } }),
      log('2026-11-06', { a: { status: 'done', amount: 10, target: 10 } }),
    ]);
    // today (07) not logged yet -> streak counts back from yesterday
    expect(currentStreak('2026-11-07', logs, ms)).toBe(3);
  });
});

describe('reports', () => {
  const student = { id: 's', name: 'S', email: 's@x', role: 'student', status: 'active' } as UserProfile;
  it('flags low completion and missing logs', () => {
    const ms = [m('a', '2026-10-01')];
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const r = needsAttention(student, days, ms, new Map(), '2026-11-07', 60, 3);
    expect(r?.reasons.length).toBe(2);
    const ok = needsAttention(student, days, ms, logsByDay(days.slice(0, 6).map((d) => log(d, { a: { status: 'done', amount: 10, target: 10 } }))), '2026-11-07', 60, 3);
    expect(ok).toBeNull();
  });
  it('escapes csv', () => {
    expect(toCsv([['a,b', 'c"d', 'خ']])).toBe('"a,b","c""d",خ');
  });
});
