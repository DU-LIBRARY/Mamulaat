import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueSlots, fajrReport, hasLogged, isDue, localNow, toMinutes, userChangeNotice, weekdayOf } from './reminders';

test('localNow uses the project timezone', () => {
  const t = new Date('2026-11-07T22:30:00Z');
  assert.deepEqual(localNow('Asia/Karachi', t), { date: '2026-11-08', minutes: 3 * 60 + 30 });
  assert.deepEqual(localNow('UTC', t), { date: '2026-11-07', minutes: 22 * 60 + 30 });
});

test('isDue respects time, window and once-per-day', () => {
  const base = { defaultTime: '20:00', today: '2026-11-07', lastReminderDate: null };
  assert.equal(isDue({ ...base, reminderTime: '21:00', nowMinutes: 20 * 60 + 59 }), false);
  assert.equal(isDue({ ...base, reminderTime: '21:00', nowMinutes: 21 * 60 }), true);
  assert.equal(isDue({ ...base, reminderTime: '21:00', nowMinutes: 21 * 60 + 14 }), true);
  assert.equal(isDue({ ...base, reminderTime: null, nowMinutes: 20 * 60 + 5 }), true);
  assert.equal(isDue({ ...base, reminderTime: '08:00', nowMinutes: 23 * 60 }), false);
  assert.equal(isDue({ ...base, lastReminderDate: '2026-11-07', reminderTime: '21:00', nowMinutes: 21 * 60 }), false);
});

test('helpers', () => {
  assert.equal(toMinutes('07:45'), 465);
  assert.equal(toMinutes('7:45'), null);
  assert.equal(hasLogged(undefined), false);
  assert.equal(hasLogged({ entries: {} }), false);
  assert.equal(hasLogged({ entries: { a: {} } }), true);
});

test('userChangeNotice: sign-up finished tells the admin, approval tells the student', () => {
  assert.equal(userChangeNotice({ status: 'pending', signupComplete: false }, { status: 'pending', signupComplete: true }), 'admin-signup');
  assert.equal(userChangeNotice({ status: 'pending', signupComplete: true }, { status: 'pending', signupComplete: true }), null);
  assert.equal(userChangeNotice({ role: 'student', status: 'pending' }, { role: 'student', status: 'active' }), 'student-approved');
  assert.equal(userChangeNotice({ role: 'student', status: 'inactive' }, { role: 'student', status: 'active' }), 'student-approved');
  assert.equal(userChangeNotice({ role: 'student', status: 'active' }, { role: 'student', status: 'active' }), null);
  assert.equal(userChangeNotice(undefined, { role: 'student', status: 'active' }), null);
  assert.equal(userChangeNotice({ role: 'student', status: 'active' }, { role: 'admin', status: 'active' }), null);
  assert.equal(userChangeNotice({ status: 'pending' }, undefined), null);
});

test('dueSlots: daily 23:00 and Friday 12:00, each sent once', () => {
  const slots = [{ time: '23:00', body: 'daily' }, { time: '12:00', weekday: 5, body: 'friday' }];
  const fri = '2026-11-13';
  assert.equal(weekdayOf(fri), 5);
  const keys = (d: string, m: number, sent = {}) => dueSlots(slots, d, m, sent).map((x) => x.key);
  assert.deepEqual(keys(fri, 11 * 60 + 59), []);
  assert.deepEqual(keys(fri, 12 * 60 + 4), ['2026-11-13 12:00']);
  assert.deepEqual(keys(fri, 12 * 60 + 4, { '2026-11-13 12:00': 1 }), []);
  assert.deepEqual(keys(fri, 13 * 60), []); // too late for that slot
  assert.deepEqual(keys('2026-11-12', 12 * 60 + 4), []); // Thursday: no noon reminder
  assert.deepEqual(keys('2026-11-12', 23 * 60 + 4), ['2026-11-12 23:00']);
  assert.deepEqual(keys('2026-11-12', 23 * 60 + 59), ['2026-11-12 23:00']);
});

test('fajrReport counts only the roster and treats absent entries as not logged', () => {
  const roster = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
  const roll = { r: { a: { status: 'missed' }, b: { status: 'qadha' }, c: { status: 'takbir' }, d: { status: 'jamaat' }, gone: { status: 'missed' } } };
  const r = fajrReport(roster, roll);
  assert.deepEqual([r.missed, r.qadha, r.notLogged, r.inJamaat], [1, 1, 1, 2]);
  assert.equal(r.body, '3 missed');
  assert.equal(fajrReport({ a: 'A', b: 'B' }, { r: { a: { status: 'prayed' }, b: { status: 'missed' } } }).body, '1 missed');
  assert.equal(fajrReport(roster, undefined).notLogged, 5);
});
