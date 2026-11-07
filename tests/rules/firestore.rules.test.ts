/**
 * Firestore Security Rules tests. Run with:  npm run test:rules
 * (starts the Firestore emulator via `firebase emulators:exec`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const ADMIN = 'admin-uid';
const TEACHER = 'teacher-uid';
const A = 'student-a';
const B = 'student-b';
const PENDING = 'pending-uid';
const INACTIVE = 'inactive-uid';

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
const today = ymd(new Date());
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86400000));
const tomorrow = ymd(new Date(Date.now() + 86400000 * 2));

function profile(role: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    name: role,
    email: `${role}@example.com`,
    photoURL: null,
    role,
    status,
    classId: status === 'active' && role === 'student' ? 'class-1' : null,
    reminderEnabled: false,
    reminderTime: null,
    onboarded: true,
    createdAt: Timestamp.now(),
    ...extra,
  };
}

function db(uid: string | null, email?: string) {
  return uid
    ? env.authenticatedContext(uid, { email: email ?? `${uid}@example.com` }).firestore()
    : env.unauthenticatedContext().firestore();
}

function logDoc(day: string) {
  return { date: day, entries: { m1: { status: 'done', amount: 1, target: 1 } }, updatedAt: serverTimestamp() };
}

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [h, p] = host.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-mamulaat',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: h,
      port: Number(p),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'settings/app'), {
      backfillDays: 2,
      weekStart: 1,
      timezone: 'UTC',
      utcOffsetMinutes: 0,
      attentionThreshold: 60,
      attentionNoLogDays: 3,
      defaultReminderTime: '20:00',
    });
    await setDoc(doc(f, 'classes/class-1'), { name: 'Class 1' });
    await setDoc(doc(f, 'classes/class-2'), { name: 'Class 2' });
    await setDoc(doc(f, `users/${ADMIN}`), profile('admin', 'active'));
    await setDoc(doc(f, `users/${TEACHER}`), profile('student', 'active', { name: 'Teacher' }));
    await setDoc(doc(f, `users/${A}`), profile('student', 'active'));
    await setDoc(doc(f, `users/${B}`), profile('student', 'active'));
    await setDoc(doc(f, `users/${PENDING}`), profile('student', 'pending'));
    await setDoc(doc(f, `users/${INACTIVE}`), profile('student', 'inactive'));
    for (const uid of [A, B]) {
      await setDoc(doc(f, `users/${uid}/mamoolaat/m1`), {
        name: 'Quran', target: 1, unit: 'juz', active: true, order: 0,
        createdBy: uid, createdAt: Timestamp.now(), createdDate: daysAgo(10),
        removedDate: null, updatedBy: uid, updatedAt: Timestamp.now(),
      });
      await setDoc(doc(f, `users/${uid}/logs/${daysAgo(1)}`), {
        date: daysAgo(1), entries: {}, updatedAt: Timestamp.now(),
      });
      await setDoc(doc(f, `users/${uid}/comments/c1`), {
        text: 'Well done', authorId: ADMIN, authorName: 'Admin', createdAt: Timestamp.now(), readAt: null,
      });
    }
  });
});

describe('student isolation', () => {
  it('student A can read their own data', async () => {
    const f = db(A);
    await assertSucceeds(getDoc(doc(f, `users/${A}`)));
    await assertSucceeds(getDocs(collection(f, `users/${A}/mamoolaat`)));
    await assertSucceeds(getDocs(collection(f, `users/${A}/logs`)));
    await assertSucceeds(getDocs(collection(f, `users/${A}/comments`)));
  });

  it("student A cannot read student B's profile, mamoolaat, logs or comments", async () => {
    const f = db(A);
    await assertFails(getDoc(doc(f, `users/${B}`)));
    await assertFails(getDocs(collection(f, `users/${B}/mamoolaat`)));
    await assertFails(getDoc(doc(f, `users/${B}/logs/${daysAgo(1)}`)));
    await assertFails(getDocs(collection(f, `users/${B}/logs`)));
    await assertFails(getDocs(collection(f, `users/${B}/comments`)));
  });

  it('student cannot list all users', async () => {
    await assertFails(getDocs(collection(db(A), 'users')));
  });

  it("student A cannot write into student B's data", async () => {
    const f = db(A);
    await assertFails(setDoc(doc(f, `users/${B}/logs/${today}`), logDoc(today)));
    await assertFails(updateDoc(doc(f, `users/${B}/mamoolaat/m1`), { name: 'hacked' }));
  });

  it('student cannot read another class or the audit log', async () => {
    const f = db(A);
    await assertSucceeds(getDoc(doc(f, 'classes/class-1')));
    await assertFails(getDoc(doc(f, 'classes/class-2')));
    await assertFails(getDocs(collection(f, 'auditLog')));
  });

  it('unauthenticated users can read nothing', async () => {
    const f = db(null);
    await assertFails(getDoc(doc(f, `users/${A}`)));
    await assertFails(getDoc(doc(f, 'settings/app')));
  });
});

describe('privilege escalation', () => {
  it('student cannot make themselves admin', async () => {
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { role: 'admin' }));
  });

  it('student cannot change their own status or class', async () => {
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { status: 'inactive' }));
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { classId: 'class-2' }));
  });

  it('student can change reminder settings', async () => {
    await assertSucceeds(
      updateDoc(doc(db(A), `users/${A}`), { reminderEnabled: true, reminderTime: '21:15' }),
    );
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { reminderTime: '25:99' }));
  });

  it('pending user cannot approve themselves', async () => {
    await assertFails(updateDoc(doc(db(PENDING), `users/${PENDING}`), { status: 'active' }));
    await assertFails(
      updateDoc(doc(db(PENDING), `users/${PENDING}`), { status: 'active', classId: 'class-1' }),
    );
  });

  it('new sign-ups can only create a pending student profile for themselves', async () => {
    const f = db('newbie', 'newbie@example.com');
    const base = {
      name: 'New', email: 'newbie@example.com', photoURL: null, classId: null,
      reminderEnabled: false, reminderTime: null, onboarded: false, createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(f, 'users/newbie'), { ...base, role: 'admin', status: 'active' }));
    await assertFails(setDoc(doc(f, 'users/newbie'), { ...base, role: 'student', status: 'active' }));
    await assertFails(setDoc(doc(f, 'users/someone-else'), { ...base, role: 'student', status: 'pending' }));
    await assertFails(
      setDoc(doc(f, 'users/newbie'), { ...base, email: 'spoof@example.com', role: 'student', status: 'pending' }),
    );
    await assertSucceeds(setDoc(doc(f, 'users/newbie'), { ...base, role: 'student', status: 'pending' }));
  });

  it('student cannot write comments, but can mark them read', async () => {
    const f = db(A);
    await assertFails(
      setDoc(doc(f, `users/${A}/comments/c2`), {
        text: 'fake', authorId: A, authorName: 'A', createdAt: serverTimestamp(), readAt: null,
      }),
    );
    await assertFails(updateDoc(doc(f, `users/${A}/comments/c1`), { text: 'edited' }));
    await assertSucceeds(updateDoc(doc(f, `users/${A}/comments/c1`), { readAt: serverTimestamp() }));
  });

  it('student cannot change settings or classes, or write the audit log', async () => {
    const f = db(A);
    await assertFails(updateDoc(doc(f, 'settings/app'), { backfillDays: 30 }));
    await assertFails(setDoc(doc(f, 'classes/x'), { name: 'X' }));
    await assertFails(
      setDoc(doc(f, 'auditLog/x'), { actorId: A, action: 'x', details: {}, createdAt: serverTimestamp() }),
    );
  });

  it('admin cannot simply create a second admin', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), `users/${TEACHER}`), { role: 'admin' }));
  });

  it('admin cannot demote themselves without handing over', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), `users/${ADMIN}`), { role: 'student' }));
    await assertFails(updateDoc(doc(db(ADMIN), `users/${ADMIN}`), { status: 'inactive' }));
  });
});

describe('pending and inactive users', () => {
  for (const uid of [PENDING, INACTIVE]) {
    it(`${uid} can read only their own basic profile`, async () => {
      const f = db(uid);
      await assertSucceeds(getDoc(doc(f, `users/${uid}`)));
      await assertFails(getDoc(doc(f, 'settings/app')));
      await assertFails(getDocs(collection(f, `users/${uid}/mamoolaat`)));
      await assertFails(getDocs(collection(f, `users/${uid}/logs`)));
      await assertFails(getDoc(doc(f, 'classes/class-1')));
      await assertFails(getDoc(doc(f, `users/${A}`)));
    });

    it(`${uid} cannot write mamoolaat, logs or reminders`, async () => {
      const f = db(uid);
      await assertFails(setDoc(doc(f, `users/${uid}/logs/${today}`), logDoc(today)));
      await assertFails(
        setDoc(doc(f, `users/${uid}/mamoolaat/x`), {
          name: 'X', target: 1, unit: '', active: true, order: 0, createdBy: uid,
          createdAt: serverTimestamp(), createdDate: today, removedDate: null,
          updatedBy: uid, updatedAt: serverTimestamp(),
        }),
      );
      await assertFails(updateDoc(doc(f, `users/${uid}`), { reminderEnabled: true }));
      await assertSucceeds(updateDoc(doc(f, `users/${uid}`), { name: 'Updated name' }));
    });
  }
});

describe('locked days', () => {
  it('student can log today and within the backfill window', async () => {
    const f = db(A);
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${today}`), logDoc(today)));
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${daysAgo(1)}`), logDoc(daysAgo(1))));
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${daysAgo(2)}`), logDoc(daysAgo(2))));
  });

  it('student cannot edit days older than the backfill window', async () => {
    const f = db(A);
    await assertFails(setDoc(doc(f, `users/${A}/logs/${daysAgo(4)}`), logDoc(daysAgo(4))));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${daysAgo(30)}`), logDoc(daysAgo(30))));
  });

  it('student cannot log future days', async () => {
    await assertFails(setDoc(doc(db(A), `users/${A}/logs/${tomorrow}`), logDoc(tomorrow)));
  });

  it('the window follows the admin setting', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'settings/app'), { backfillDays: 0 });
    });
    const f = db(A);
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${today}`), logDoc(today)));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${daysAgo(2)}`), logDoc(daysAgo(2))));
  });

  it('log ids must be dates and match the date field', async () => {
    const f = db(A);
    await assertFails(setDoc(doc(f, `users/${A}/logs/not-a-date`), logDoc('not-a-date')));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), logDoc(daysAgo(1))));
  });

  it('admin cannot write student logs', async () => {
    await assertFails(setDoc(doc(db(ADMIN), `users/${A}/logs/${today}`), logDoc(today)));
  });
});

describe('admin', () => {
  it('admin can read every student and their data', async () => {
    const f = db(ADMIN);
    await assertSucceeds(getDocs(collection(f, 'users')));
    await assertSucceeds(getDocs(collection(f, `users/${B}/logs`)));
    await assertSucceeds(getDocs(collection(f, `users/${B}/mamoolaat`)));
  });

  it('admin can approve, assign, comment and edit mamoolaat', async () => {
    const f = db(ADMIN);
    await assertSucceeds(updateDoc(doc(f, `users/${PENDING}`), { status: 'active', classId: 'class-1' }));
    await assertSucceeds(
      setDoc(doc(f, `users/${A}/comments/c9`), {
        text: 'Keep going', authorId: ADMIN, authorName: 'Admin', createdAt: serverTimestamp(), readAt: null,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(f, `users/${A}/mamoolaat/m1`), {
        target: 2, updatedBy: ADMIN, updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(f, 'auditLog/a1'), { actorId: ADMIN, action: 'test', details: {}, createdAt: serverTimestamp() }),
    );
  });

  it('audit log is append-only', async () => {
    const f = db(ADMIN);
    await assertSucceeds(
      setDoc(doc(f, 'auditLog/a1'), { actorId: ADMIN, action: 'test', details: {}, createdAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(f, 'auditLog/a1'), { action: 'changed' }));
    await assertFails(deleteDoc(doc(f, 'auditLog/a1')));
  });

  it('admin can delete a student and their data', async () => {
    const f = db(ADMIN);
    await assertSucceeds(deleteDoc(doc(f, `users/${B}/logs/${daysAgo(1)}`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${B}/mamoolaat/m1`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${B}/comments/c1`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${B}`)));
  });
});

describe('admin handover', () => {
  async function handover() {
    const f = db(ADMIN);
    const batch = writeBatch(f);
    batch.update(doc(f, `users/${TEACHER}`), { role: 'admin', status: 'active', classId: null });
    batch.update(doc(f, `users/${ADMIN}`), { role: 'student', status: 'inactive', handedOverTo: TEACHER });
    batch.set(doc(f, 'auditLog/handover'), {
      actorId: ADMIN, action: 'transferAdmin', details: { to: TEACHER }, createdAt: serverTimestamp(),
    });
    await batch.commit();
  }

  it('handover moves the role atomically', async () => {
    await assertSucceeds(handover());
    const t = await getDoc(doc(db(TEACHER), `users/${TEACHER}`));
    if (t.data()?.role !== 'admin') throw new Error('teacher should be admin');
  });

  it('handover to a pending user is rejected', async () => {
    const f = db(ADMIN);
    const batch = writeBatch(f);
    batch.update(doc(f, `users/${PENDING}`), { role: 'admin' });
    batch.update(doc(f, `users/${ADMIN}`), { role: 'student', status: 'inactive', handedOverTo: PENDING });
    await assertFails(batch.commit());
  });

  it('the old admin loses all access to student data after handover', async () => {
    await handover();
    const f = db(ADMIN);
    await assertFails(getDocs(collection(f, 'users')));
    await assertFails(getDoc(doc(f, `users/${A}`)));
    await assertFails(getDocs(collection(f, `users/${A}/logs`)));
    await assertFails(getDocs(collection(f, `users/${A}/mamoolaat`)));
    await assertFails(getDocs(collection(f, 'auditLog')));
    await assertFails(getDoc(doc(f, 'settings/app')));
    // and cannot take the role back
    await assertFails(updateDoc(doc(f, `users/${ADMIN}`), { role: 'admin', status: 'active' }));
  });

  it('the new admin has access', async () => {
    await handover();
    const f = db(TEACHER);
    await assertSucceeds(getDocs(collection(f, 'users')));
    await assertSucceeds(getDocs(collection(f, `users/${A}/logs`)));
    await assertSucceeds(getDocs(collection(f, 'auditLog')));
  });
});
