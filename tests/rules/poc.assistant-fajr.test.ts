/**
 * PoC: does a limited admin (assistant) breach the Fajr-roll privacy boundary?
 * Run with: npm run test:rules  (alongside the main suite)
 *
 * PRODUCT/rules invariant: an 'assistant' must NOT see any individual's salah,
 * "including the Fajr roll". Assistants are allowed to set a class's fajrMonitorId.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch, deleteField, Timestamp,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const ADMIN = 'admin-uid', ASSIST = 'assistant-uid', A = 'student-a', B = 'student-b';
const today = new Date().toISOString().slice(0, 10);

function profile(role: string, status: string, extra: Record<string, unknown> = {}) {
  return { name: role, email: `${role}@example.com`, photoURL: null, role, status,
    classId: status === 'active' && role === 'student' ? 'class-1' : null,
    reminderEnabled: false, reminderTime: null, onboarded: true, createdAt: Timestamp.now(), ...extra };
}
const db = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();

beforeAll(async () => {
  const [h, p] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-mamulaat',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'), host: h, port: Number(p) },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'settings/app'), { backfillDays: 2, weekStart: 1, timezone: 'UTC',
      utcOffsetMinutes: 0, attentionThreshold: 60, attentionNoLogDays: 3, defaultReminderTime: '20:00' });
    await setDoc(doc(f, 'classes/class-1'), { name: 'Class 1' });
    await setDoc(doc(f, `users/${ADMIN}`), profile('admin', 'active'));
    await setDoc(doc(f, `users/${ASSIST}`), profile('assistant', 'active'));
    await setDoc(doc(f, `users/${A}`), profile('student', 'active'));
    await setDoc(doc(f, `users/${B}`), profile('student', 'active'));
    // Student A logs their Fajr as missed (salah + roll entry, one batch — what the app does).
    await setDoc(doc(f, `users/${A}/salah/${today}`), { date: today, entries: { fajr: 'missed' }, updatedAt: Timestamp.now() });
    await setDoc(doc(f, `classes/class-1/fajrRoll/${today}`), { r: { [A]: { status: 'missed' } } });
    await setDoc(doc(f, 'classes/class-1/meta/roster'), { names: { [A]: 'A', [B]: 'B' } });
  });
});

describe('PoC — assistant Fajr-roll boundary', () => {
  it('baseline: a plain assistant CANNOT read the Fajr roll (salah status)', async () => {
    // (the roster — names only — is intentionally staff-readable; the Fajr *status* is not)
    await assertFails(getDoc(doc(db(ASSIST), `classes/class-1/fajrRoll/${today}`)));
  });

  it('FIXED: assistant cannot self-appoint as Fajr monitor, nor read the roll if already set', async () => {
    // Write side: an assistant may no longer be named Fajr monitor (must be a student).
    await assertFails(updateDoc(doc(db(ASSIST), 'classes/class-1'), { fajrMonitorId: ASSIST }));
    // Read side (defence in depth): even a stale class doc naming an assistant grants no access.
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'classes/class-1'), { name: 'Class 1', fajrMonitorId: ASSIST }, { merge: true }));
    await assertFails(getDoc(doc(db(ASSIST), `classes/class-1/fajrRoll/${today}`)));
  });
});
