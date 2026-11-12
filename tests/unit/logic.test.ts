import { adminStatus, fajrRollSummary, missedCount, salahStats, unloggedIsMissed } from '../../src/lib/salah';
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
  it('does not count the days a restored mamool was removed (gap)', () => {
    const g = m('g', '2026-11-01', { gaps: [{ from: '2026-11-03', to: '2026-11-05' }] });
    expect(scheduledFor('2026-11-02', [g]).length).toBe(1);
    expect(scheduledFor('2026-11-03', [g]).length).toBe(0);
    expect(scheduledFor('2026-11-04', [g]).length).toBe(0);
    expect(scheduledFor('2026-11-05', [g]).length).toBe(1); // restored on the 5th
  });
  it('a day with nothing scheduled has no completion and breaks no streak maths', () => {
    const s = dayStats('2026-10-01', undefined, ms);
    expect(s.scheduled).toBe(0);
    expect(s.hasLog).toBe(false);
  });
  it('computes completion', () => {
    const s = dayStats('2026-11-06', log('2026-11-06', {
      a: { status: 'done', amount: 10, target: 10 },
      b: { status: 'partial', amount: 5, target: 10 },
    }), ms);
    expect(s.completion).toBeCloseTo(0.75);
    const full = dayStats('2026-11-06', log('2026-11-06', {
      a: { status: 'done', amount: 10, target: 10 }, b: { status: 'done', amount: 10, target: 10 },
    }), ms);
    expect(full.done).toBe(2);
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

import { daysAgoLabel, lastEditableDay, monthDays } from '../../src/lib/dates';
import { findOverlaps, sameMamoolName, similarMamoolName } from '../../src/lib/names';
import { registerRows, studentDetailRows } from '../../src/lib/exports';

describe('new date helpers', () => {
  it('lists the days of a month', () => {
    expect(monthDays('2028-02-15')).toHaveLength(29);
    expect(monthDays('2026-11-07')[0]).toBe('2026-11-01');
    expect(monthDays('2026-11-07').at(-1)).toBe('2026-11-30');
  });
  it('knows when a day locks', () => {
    expect(lastEditableDay('2026-11-05', 2)).toBe('2026-11-07');
    expect(lastEditableDay('2026-11-05', 0)).toBe('2026-11-05');
  });
  it('labels last seen', () => {
    expect(daysAgoLabel(null)).toBe('never');
    expect(daysAgoLabel(0)).toBe('today');
    expect(daysAgoLabel(1)).toBe('yesterday');
    expect(daysAgoLabel(9)).toBe('9 days ago');
  });
});

describe('mamool names (class templates and overlaps)', () => {
  it('matches the same name loosely', () => {
    expect(sameMamoolName('Tasbeeh', ' tasbeeh. ')).toBe(true);
    expect(sameMamoolName('Durood Shareef', 'durood-shareef')).toBe(true);
    expect(sameMamoolName('سورۃ الملک', 'سورۃ الملک')).toBe(true);
    expect(sameMamoolName('Tasbeeh', 'Tahajjud')).toBe(false);
  });
  it('spots likely overlaps', () => {
    expect(similarMamoolName('Quran', 'Quran tilawat')).toBe(true);
    expect(similarMamoolName('Dua', 'Duas after salah')).toBe(false); // too short to guess
    const o = findOverlaps([
      { id: 'a', name: 'Quran tilawat' },
      { id: 'b', name: 'Quran' },
      { id: 'c', name: 'Tasbeeh' },
    ]);
    expect(o.get('a')?.id).toBe('b');
    expect(o.get('b')?.id).toBe('a');
    expect(o.has('c')).toBe(false);
  });
});

describe('exports', () => {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04'];
  const mams = [m('q', '2026-11-01', { name: 'Quran', target: 1, unit: 'juz' }), m('t', '2026-11-03', { name: 'Tasbeeh', target: 100, unit: 'times' })];
  const logs = logsByDay([
    log('2026-11-02', { q: { status: 'done', amount: 1, target: 1 } }),
    log('2026-11-03', { q: { status: 'missed', amount: 0, target: 1 }, t: { status: 'partial', amount: 50, target: 100 } }),
  ]);
  const student = { id: 's1', name: 'Aisha' } as UserProfile;

  it('builds register rows per student and per mamool', () => {
    const rows = registerRows([student], new Map([['s1', { mamoolaat: mams, logs }]]), days, '2026-11-03', () => 'Class A');
    expect(rows[0]).toEqual(['Student', 'Class', 'Mamool', 'Target', ...days, 'Overall %', 'Full days', 'Days logged']);
    // ALL row: day 1 = 100, day 2 = (0 + 50)/2 = 25, day 3 is in the future
    expect(rows[1]).toEqual(['Aisha', 'Class A', 'ALL', '', 100, 25, '', 63, 1, 2]);
    expect(rows[2].slice(2, 7)).toEqual(['Quran', '1 juz', 100, 0, '']);
    expect(rows[3].slice(2, 7)).toEqual(['Tasbeeh', '100 times', '', 50, '']);
  });

  it("builds one student's detailed rows", () => {
    const rows = studentDetailRows(mams, logs, days, '2026-11-03');
    expect(rows[1]).toEqual(['Quran', '1 juz', 'done', 'missed', '', 50]);
    expect(rows[2]).toEqual(['Tasbeeh', '100 times', '', '50/100 (50%)', '', 50]);
    expect(rows.at(-1)).toEqual(['ALL', '', 100, 25, '', 63]);
  });
});

describe('cleared / unlogged days are not shown as 0', () => {
  it('does not count today in the week until something is logged', async () => {
    const { periodCompletion, mamoolCompletion } = await import('../../src/lib/scoring');
    const { studentWeek } = await import('../../src/lib/reports');
    const q = m('q', '2026-11-01');
    const days = ['2026-11-06', '2026-11-07'];
    const logs = logsByDay([log('2026-11-06', { q: { status: 'done', amount: 10, target: 10 } })]);
    // today (11-07) has nothing logged: week stays 100%, not 50%
    expect(periodCompletion(days, logs, [q], '2026-11-07')).toBe(1);
    expect(mamoolCompletion(q, days, logs, '2026-11-07', [q])).toBe(1);
    // a cleared day (log doc with no entries) behaves the same as no log
    const cleared = logsByDay([...logs.values(), log('2026-11-07', {})]);
    expect(periodCompletion(days, cleared, [q], '2026-11-07')).toBe(1);
    const w = studentWeek({ id: 's' } as UserProfile, days, [q], cleared, '2026-11-07');
    expect(w.days.map((d) => d.hasLog)).toEqual([true, false]);
    expect(w.perMamool[0].logged).toEqual([true, false]);
    // past days with nothing logged still count as 0
    expect(periodCompletion(days, logsByDay([]), [q], '2026-11-08')).toBe(0);
  });
  it('a mamool added and removed the same day never counts', () => {
    const x = m('x', '2026-11-07', { active: false, removedDate: '2026-11-07' });
    expect(scheduledFor('2026-11-07', [x])).toEqual([]);
    expect(dayStats('2026-11-07', undefined, [x]).scheduled).toBe(0);
  });
});

describe('salah', () => {
  it('counts statuses and jamaat for a day', () => {
    const s = salahStats({ id: 'd', date: 'd', entries: { fajr: 'takbir', zuhr: 'jamaat', asr: 'qadha', maghrib: 'missed' } });
    expect(s).toMatchObject({ logged: 4, takbir: 1, jamaat: 1, qadha: 1, missed: 1, inJamaat: 2 });
    expect(salahStats(undefined).logged).toBe(0);
  });

  it('groups the class for the Fajr roll; unlisted entries are ignored', () => {
    const sum = fajrRollSummary(
      { a: 'Bilal', b: 'Ahmad', c: 'Zaid', d: 'Umar' },
      { r: { a: { name: 'Bilal', status: 'missed' }, b: { name: 'Ahmad', status: 'qadha' }, d: { name: 'Umar', status: 'prayed' }, x: { name: 'Left', status: 'missed' } } },
    );
    expect(sum.missed.map((p) => p.name)).toEqual(['Bilal']);
    expect(sum.qadha.map((p) => p.name)).toEqual(['Ahmad']);
    expect(sum.notLogged.map((p) => p.name)).toEqual(['Zaid']);
    expect(sum.inJamaat.map((p) => p.name)).toEqual(['Umar']);
    expect(fajrRollSummary({ a: 'A', b: 'B' }, null).notLogged).toHaveLength(2);
  });
});

describe('missedCount', () => {
  const day = (entries: Record<string, string>) => ({ entries }) as never;
  const by = new Map([
    ['2026-11-10', day({ fajr: 'missed' })], // before the rule starts: only what's logged counts
    ['2026-11-12', day({ fajr: 'missed', zuhr: 'qadha', asr: 'jamaat', maghrib: 'takbir' })], // isha not logged
    ['2026-11-14', day({ fajr: 'missed' })], // today: the rest not logged yet
  ]);
  const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  it('counts missed, qadha and unlogged from 12 Nov, not earlier unlogged, today’s unlogged or future days', () => {
    // 11-10: 1 logged missed; 11-11: 0 (before the rule); 11-12: missed+qadha+isha = 3; 11-13: nothing logged = 5; 11-14: 1
    expect(missedCount(by, days, '2026-11-14')).toBe(10);
  });
  it('can count Fajr only', () => {
    expect(missedCount(by, days, '2026-11-14', ['fajr'])).toBe(4);
  });
  it('unloggedIsMissed only for days that are over, from 12 Nov', () => {
    expect(unloggedIsMissed('2026-11-11', '2026-11-14')).toBe(false);
    expect(unloggedIsMissed('2026-11-12', '2026-11-14')).toBe(true);
    expect(unloggedIsMissed('2026-11-14', '2026-11-14')).toBe(false);
  });
});

describe('adminStatus', () => {
  it('shows Takbir Ula as Jamaat and qadha as missed', () => {
    expect(adminStatus('takbir')).toBe('jamaat');
    expect(adminStatus('jamaat')).toBe('jamaat');
    expect(adminStatus('qadha')).toBe('missed');
    expect(adminStatus('missed')).toBe('missed');
    expect(adminStatus(undefined)).toBeUndefined();
  });
});
