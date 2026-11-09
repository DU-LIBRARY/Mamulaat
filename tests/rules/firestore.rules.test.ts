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
  deleteField,
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

  it('student cannot read the audit log', async () => {
    await assertFails(getDocs(collection(db(A), 'auditLog')));
  });

  it('signed-in users can read class names (so new students can pick one); anonymous users cannot', async () => {
    await assertSucceeds(getDocs(collection(db(A), 'classes')));
    await assertSucceeds(getDocs(collection(db(PENDING), 'classes')));
    await assertFails(getDocs(collection(db(null), 'classes')));
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

describe('sign-up: name and requested class', () => {
  it('a pending user can set their name and request an existing class', async () => {
    const f = db(PENDING);
    await assertSucceeds(
      updateDoc(doc(f, `users/${PENDING}`), { name: 'Aisha Rahman', requestedClassId: 'class-2', signupComplete: true }),
    );
  });

  it('requesting a class that does not exist is rejected', async () => {
    await assertFails(updateDoc(doc(db(PENDING), `users/${PENDING}`), { requestedClassId: 'made-up', signupComplete: true }));
  });

  it('a blank name is rejected', async () => {
    await assertFails(updateDoc(doc(db(PENDING), `users/${PENDING}`), { name: '   ' }));
  });

  it('requesting a class does not put the student in it', async () => {
    const f = db(PENDING);
    await assertSucceeds(updateDoc(doc(f, `users/${PENDING}`), { requestedClassId: 'class-1', signupComplete: true }));
    await assertFails(updateDoc(doc(f, `users/${PENDING}`), { classId: 'class-1' }));
    await assertFails(updateDoc(doc(f, `users/${PENDING}`), { status: 'active', classId: 'class-1' }));
    await assertFails(getDocs(collection(f, `users/${PENDING}/mamoolaat`)));
  });

  it('an active student can rename themselves but cannot change the request fields', async () => {
    const f = db(A);
    await assertSucceeds(updateDoc(doc(f, `users/${A}`), { name: 'New Name' }));
    await assertFails(updateDoc(doc(f, `users/${A}`), { requestedClassId: 'class-2' }));
  });

  it('a new profile cannot arrive already signed-up or with a requested class', async () => {
    const f = db('newbie2', 'newbie2@example.com');
    const base = {
      name: 'N', email: 'newbie2@example.com', photoURL: null, classId: null, role: 'student', status: 'pending',
      reminderEnabled: false, reminderTime: null, onboarded: false, createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(f, 'users/newbie2'), { ...base, requestedClassId: 'class-1' }));
    await assertFails(setDoc(doc(f, 'users/newbie2'), { ...base, signupComplete: true }));
    await assertSucceeds(setDoc(doc(f, 'users/newbie2'), { ...base, requestedClassId: null, signupComplete: false }));
  });

  it('the admin can approve using the requested class', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `users/${PENDING}`), { requestedClassId: 'class-2', signupComplete: true });
    });
    await assertSucceeds(updateDoc(doc(db(ADMIN), `users/${PENDING}`), { status: 'active', classId: 'class-2' }));
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

  it('a student cannot stamp their log as edited by someone else', async () => {
    const f = db(A);
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), { ...logDoc(today), editedBy: ADMIN }));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), { ...logDoc(today), editedBy: A, editedByName: 'x' }));
  });

  it('a student write must clear an earlier admin stamp', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${A}/logs/${today}`), { ...logDoc(today), updatedAt: Timestamp.now(), editedBy: ADMIN });
    });
    const f = db(A);
    // keeping the stamp (plain merge write) is refused; removing it with deleteField works
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), { date: today, entries: {}, updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(
      setDoc(doc(f, `users/${A}/logs/${today}`), { date: today, entries: {}, updatedAt: serverTimestamp(), editedBy: deleteField(), editedByName: deleteField() }, { merge: true }),
    );
  });
});

describe('day off', () => {
  const adminLog = (day: string, extra: Record<string, unknown> = {}) => ({ ...logDoc(day), editedBy: ADMIN, editedByName: 'Admin', ...extra });

  it('only the admin can mark a day off; a student cannot set, clear or delete it', async () => {
    await assertFails(setDoc(doc(db(A), `users/${A}/logs/${today}`), { ...logDoc(today), off: true }));
    await assertFails(setDoc(doc(db(ADMIN), `users/${A}/logs/${today}`), adminLog(today, { off: 'yes' })));
    await assertSucceeds(setDoc(doc(db(ADMIN), `users/${A}/logs/${today}`), adminLog(today, { off: true })));
    const f = db(A);
    const clearStamp = { editedBy: deleteField(), editedByName: deleteField() };
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), { date: today, entries: {}, updatedAt: serverTimestamp(), off: deleteField(), ...clearStamp }, { merge: true }));
    await assertFails(deleteDoc(doc(f, `users/${A}/logs/${today}`)));
    // logging on a day off keeps the flag
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${today}`), { date: today, entries: {}, updatedAt: serverTimestamp(), ...clearStamp }, { merge: true }));
  });
});

describe('admin edits student logs (any day)', () => {
  const adminLog = (day: string, extra: Record<string, unknown> = {}) => ({ ...logDoc(day), editedBy: ADMIN, editedByName: 'Admin', ...extra });

  it('admin can write today, a locked day and an old day, stamped with their uid', async () => {
    const f = db(ADMIN);
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${today}`), adminLog(today)));
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${daysAgo(30)}`), adminLog(daysAgo(30))));
    await assertSucceeds(setDoc(doc(f, `users/${A}/logs/${daysAgo(400)}`), adminLog(daysAgo(400))));
  });

  it('admin log must carry their own uid as editedBy', async () => {
    const f = db(ADMIN);
    await assertFails(setDoc(doc(f, `users/${A}/logs/${daysAgo(30)}`), logDoc(daysAgo(30))));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${daysAgo(30)}`), adminLog(daysAgo(30), { editedBy: A })));
  });

  it('admin log still has to be a valid log', async () => {
    const f = db(ADMIN);
    await assertFails(setDoc(doc(f, `users/${A}/logs/not-a-date`), adminLog('not-a-date')));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), adminLog(daysAgo(1))));
    await assertFails(setDoc(doc(f, `users/${A}/logs/${today}`), adminLog(today, { extra: 1 })));
  });

  it('admin cannot create logs for a user that does not exist', async () => {
    await assertFails(setDoc(doc(db(ADMIN), `users/ghost/logs/${today}`), adminLog(today)));
  });

  it('students cannot write another student\'s log (admin edit is admin-only)', async () => {
    await assertFails(setDoc(doc(db(A), `users/${B}/logs/${daysAgo(30)}`), adminLog(daysAgo(30), { editedBy: A })));
    await assertFails(setDoc(doc(db(B), `users/${B}/logs/${daysAgo(30)}`), adminLog(daysAgo(30), { editedBy: B })));
  });

  it('a former admin (after handover) cannot edit logs', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${TEACHER}`), profile('admin', 'active'));
      await setDoc(doc(ctx.firestore(), `users/${ADMIN}`), profile('student', 'inactive', { handedOverTo: TEACHER }));
    });
    await assertFails(setDoc(doc(db(ADMIN), `users/${A}/logs/${daysAgo(30)}`), adminLog(daysAgo(30))));
  });
});

describe("admin's own mamool", () => {
  it('admin can add their own mamool and log it (stamped as themselves, merge write like the app)', async () => {
    const f = db(ADMIN);
    await assertSucceeds(
      setDoc(doc(f, `users/${ADMIN}/mamoolaat/mine`), {
        name: 'Quran', target: 1, unit: 'juz', active: true, order: 0,
        createdBy: ADMIN, createdAt: serverTimestamp(), createdDate: today,
        removedDate: null, updatedBy: ADMIN, updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(f, `users/${ADMIN}/logs/${today}`),
        { date: today, entries: { mine: { status: 'done', amount: 1, target: 1 } }, updatedAt: serverTimestamp(), editedBy: ADMIN, editedByName: 'Admin' },
        { merge: true },
      ),
    );
  });

  it('a student-style (unstamped) write from the admin is still refused', async () => {
    await assertFails(setDoc(doc(db(ADMIN), `users/${ADMIN}/logs/${today}`), logDoc(today)));
  });
});

describe('admin edits profiles and classes', () => {
  it('admin can rename, move, deactivate and put a student back to pending', async () => {
    const f = db(ADMIN);
    await assertSucceeds(updateDoc(doc(f, `users/${A}`), { name: 'New Name' }));
    await assertSucceeds(updateDoc(doc(f, `users/${A}`), { classId: 'class-2' }));
    await assertSucceeds(updateDoc(doc(f, `users/${A}`), { status: 'inactive' }));
    await assertSucceeds(updateDoc(doc(f, `users/${A}`), { status: 'pending', classId: null }));
  });

  it('admin cannot set an empty/huge name, a missing class, or change email/other fields', async () => {
    const f = db(ADMIN);
    await assertFails(updateDoc(doc(f, `users/${A}`), { name: '   ' }));
    await assertFails(updateDoc(doc(f, `users/${A}`), { name: 'x'.repeat(101) }));
    await assertFails(updateDoc(doc(f, `users/${A}`), { classId: 'no-such-class' }));
    await assertFails(updateDoc(doc(f, `users/${A}`), { email: 'other@example.com' }));
    await assertFails(updateDoc(doc(f, `users/${A}`), { reminderEnabled: true }));
  });

  it('students cannot rename-by-admin, move or change another student', async () => {
    await assertFails(updateDoc(doc(db(A), `users/${B}`), { name: 'Hacked' }));
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { classId: 'class-2' }));
    await assertFails(updateDoc(doc(db(A), `users/${A}`), { status: 'pending' }));
  });

  it('admin can rename and delete classes; students cannot', async () => {
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'classes/class-1'), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(db(A), 'classes/class-1'), { name: 'Renamed' }));
    await assertFails(deleteDoc(doc(db(A), 'classes/class-1')));
    await assertSucceeds(deleteDoc(doc(db(ADMIN), 'classes/class-2')));
  });

  it('moving students out of a class and deleting it works as one batch', async () => {
    const f = db(ADMIN);
    const b = writeBatch(f);
    b.update(doc(f, `users/${A}`), { classId: 'class-2' });
    b.update(doc(f, `users/${B}`), { classId: 'class-2' });
    b.delete(doc(f, 'classes/class-1'));
    await assertSucceeds(b.commit());
  });
});

describe('admin deletes records outright', () => {
  it('admin can hard-delete a mamool, a log, a comment and a change record; students cannot delete others\'', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${A}/changes/ch1`), { kind: 'added', actorId: ADMIN, createdAt: Timestamp.now(), seenAt: null });
    });
    const f = db(ADMIN);
    await assertSucceeds(deleteDoc(doc(f, `users/${A}/changes/ch1`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${A}/comments/c1`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${A}/logs/${daysAgo(1)}`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${A}/mamoolaat/m1`)));
    await assertFails(deleteDoc(doc(db(A), `users/${B}/mamoolaat/m1`)));
    await assertFails(deleteDoc(doc(db(A), `users/${B}/comments/c1`)));
    await assertFails(deleteDoc(doc(db(A), `users/${A}/comments/c1`)));
  });
});

describe('restoring a removed mamool keeps a gap', () => {
  it('a student can save the gap list on restore', async () => {
    const f = db(A);
    await assertSucceeds(
      updateDoc(doc(f, `users/${A}/mamoolaat/m1`), {
        active: true, removedDate: null, gaps: [{ from: daysAgo(5), to: daysAgo(2) }], updatedBy: A, updatedAt: serverTimestamp(),
      }),
    );
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

describe('admin deleting a student (full control)', () => {
  const SUBS = ['mamoolaat', 'logs', 'comments', 'changes', 'fcmTokens'];

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      await setDoc(doc(f, `users/${B}/fcmTokens/tok1`), { createdAt: Timestamp.now(), lastSeen: Timestamp.now(), userAgent: 'x' });
      await setDoc(doc(f, `users/${B}/changes/ch1`), {
        kind: 'added', mamoolId: 'm1', mamoolName: 'Quran', before: null, after: null,
        actorId: ADMIN, actorName: 'Admin', createdAt: Timestamp.now(), seenAt: null,
      });
    });
  });

  it('admin can list every sub-collection of a student (needed to delete them)', async () => {
    const f = db(ADMIN);
    for (const sub of SUBS) await assertSucceeds(getDocs(collection(f, `users/${B}/${sub}`)));
  });

  it('admin can delete an active student and ALL their data, then the profile', async () => {
    const f = db(ADMIN);
    for (const sub of SUBS) {
      const snap = await assertSucceeds(getDocs(collection(f, `users/${B}/${sub}`)));
      for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
    }
    await assertSucceeds(deleteDoc(doc(f, `users/${B}`)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const sub of SUBS) {
        const left = await getDocs(collection(ctx.firestore(), `users/${B}/${sub}`));
        if (!left.empty) throw new Error(`${sub} not fully deleted`);
      }
    });
  });

  it('admin can delete pending, inactive and rejected users too', async () => {
    const f = db(ADMIN);
    await assertSucceeds(deleteDoc(doc(f, `users/${PENDING}`)));
    await assertSucceeds(deleteDoc(doc(f, `users/${INACTIVE}`)));
  });

  it("a student still cannot read another student's device tokens", async () => {
    await assertFails(getDocs(collection(db(A), `users/${B}/fcmTokens`)));
    await assertFails(deleteDoc(doc(db(A), `users/${B}/fcmTokens/tok1`)));
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

describe('nudges (admin "please log today" reminders)', () => {
  const nudge = (uid: string, day: string, actorId = ADMIN) => ({ uid, day, actorId, actorName: 'Admin', createdAt: serverTimestamp() });

  it('admin can nudge a student once per day; the id must match', async () => {
    const f = db(ADMIN);
    await assertSucceeds(setDoc(doc(f, `nudges/${A}_${today}`), nudge(A, today)));
    // a second nudge for the same day is an update, which is not allowed
    await assertFails(setDoc(doc(f, `nudges/${A}_${today}`), nudge(A, today)));
    await assertFails(setDoc(doc(f, `nudges/${B}_${today}`), nudge(A, today)));
    await assertFails(setDoc(doc(f, `nudges/nobody_${today}`), nudge('nobody', today)));
    await assertFails(setDoc(doc(f, `nudges/${B}_${today}`), { ...nudge(B, today), extra: 1 }));
  });

  it('students cannot send nudges, and can only read their own', async () => {
    await assertFails(setDoc(doc(db(A), `nudges/${B}_${today}`), nudge(B, today, A)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `nudges/${A}_${today}`), { uid: A, day: today, actorId: ADMIN, actorName: 'Admin', createdAt: Timestamp.now() });
    });
    await assertSucceeds(getDoc(doc(db(A), `nudges/${A}_${today}`)));
    await assertFails(getDoc(doc(db(B), `nudges/${A}_${today}`)));
    await assertFails(getDocs(collection(db(A), 'nudges')));
    await assertSucceeds(getDocs(collection(db(ADMIN), 'nudges')));
    await assertFails(deleteDoc(doc(db(A), `nudges/${A}_${today}`)));
    await assertSucceeds(deleteDoc(doc(db(ADMIN), `nudges/${A}_${today}`)));
  });
});

describe('class templates', () => {
  it('admin can set a template on a class; students cannot', async () => {
    const template = [{ name: 'Quran', target: 1, unit: 'juz' }];
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'classes/class-1'), { template }));
    await assertFails(updateDoc(doc(db(A), 'classes/class-1'), { template }));
    await assertFails(updateDoc(doc(db(ADMIN), 'classes/class-1'), { template: 'not a list' }));
    await assertFails(updateDoc(doc(db(ADMIN), 'classes/class-1'), { other: 1 }));
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ name: `m${i}`, target: 1, unit: '' }));
    await assertFails(updateDoc(doc(db(ADMIN), 'classes/class-1'), { template: tooMany }));
  });

  it('admin can add template mamoolaat to a student and record the change', async () => {
    const f = db(ADMIN);
    const b = writeBatch(f);
    b.set(doc(f, `users/${A}/mamoolaat/tpl1`), {
      name: 'Tasbeeh', target: 100, unit: 'times', active: true, order: 5, createdBy: ADMIN, createdAt: serverTimestamp(),
      createdDate: today, removedDate: null, updatedBy: ADMIN, updatedAt: serverTimestamp(),
    });
    b.set(doc(f, `users/${A}/changes/ch1`), {
      kind: 'added', mamoolId: 'tpl1', mamoolName: 'Tasbeeh', before: null, after: { name: 'Tasbeeh', target: 100, unit: 'times' },
      actorId: ADMIN, actorName: 'Admin', createdAt: serverTimestamp(), seenAt: null,
    });
    await assertSucceeds(b.commit());
    // and the student can then edit or remove it like their own
    await assertSucceeds(updateDoc(doc(db(A), `users/${A}/mamoolaat/tpl1`), { name: 'Tasbih', updatedBy: A, updatedAt: serverTimestamp() }));
  });
});

describe('last seen and device tokens', () => {
  it('a student can record when they last opened the app', async () => {
    await assertSucceeds(updateDoc(doc(db(A), `users/${A}`), { lastSeenAt: serverTimestamp() }));
  });

  it('a pending sign-up can register a device (to hear about approval); inactive users cannot', async () => {
    const t = { createdAt: serverTimestamp(), lastSeen: serverTimestamp(), userAgent: 'test' };
    await assertSucceeds(setDoc(doc(db(PENDING), `users/${PENDING}/fcmTokens/tok1`), t));
    await assertSucceeds(deleteDoc(doc(db(PENDING), `users/${PENDING}/fcmTokens/tok1`)));
    await assertFails(setDoc(doc(db(INACTIVE), `users/${INACTIVE}/fcmTokens/tok1`), t));
    await assertFails(setDoc(doc(db(PENDING), `users/${A}/fcmTokens/tok1`), t));
  });

  it('the admin can register their own device for sign-up alerts', async () => {
    const t = { createdAt: serverTimestamp(), lastSeen: serverTimestamp(), userAgent: 'test' };
    await assertSucceeds(setDoc(doc(db(ADMIN), `users/${ADMIN}/fcmTokens/tok1`), t));
    await assertSucceeds(updateDoc(doc(db(ADMIN), `users/${ADMIN}`), { reminderEnabled: true }));
  });
});
