import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasLogged, isDue, localNow, toMinutes } from './reminders';

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
