/**
 * Seeds the LOCAL Emulator Suite with a demo class, demo students and a demo admin.
 * Refuses to run against a real project.
 *
 *   npm run emulators        # in one terminal
 *   npm run seed             # in another
 *
 * Then sign in on http://localhost:5173 with the emulator's Google popup and pick
 * one of the seeded accounts (e.g. admin@demo.test or aisha@demo.test).
 */
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
const projectId = process.env.GCLOUD_PROJECT ?? 'demo-mamulaat';
if (!projectId.startsWith('demo-')) {
  console.error('Refusing to seed a non-demo project. Use a "demo-" project id with the emulators.');
  process.exit(1);
}

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp, FieldValue } = await import('firebase-admin/firestore');

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const tz = 'UTC';
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => ymd(new Date(Date.now() - n * 86400000));

const people = [
  { uid: 'demo-admin', email: 'admin@demo.test', name: 'Demo Admin', role: 'admin', status: 'active', classId: null },
  { uid: 'demo-aisha', email: 'aisha@demo.test', name: 'Aisha Rahman', role: 'student', status: 'active', classId: 'demo-class-a' },
  { uid: 'demo-yusuf', email: 'yusuf@demo.test', name: 'Yusuf Ali', role: 'student', status: 'active', classId: 'demo-class-a' },
  { uid: 'demo-maryam', email: 'maryam@demo.test', name: 'مریم خان', role: 'student', status: 'active', classId: 'demo-class-a' },
  { uid: 'demo-bilal', email: 'bilal@demo.test', name: 'Bilal Ahmed', role: 'student', status: 'active', classId: 'demo-class-b' },
  { uid: 'demo-pending', email: 'newstudent@demo.test', name: 'New Student', role: 'student', status: 'pending', classId: null },
  { uid: 'demo-teacher', email: 'teacher@demo.test', name: 'Ustadha Fatima', role: 'student', status: 'active', classId: null },
];

const lists = {
  'demo-aisha': [
    ['Quran tilawat', 1, 'juz'],
    ['Tasbeeh', 100, 'times'],
    ['Durood Shareef', 100, 'times'],
    ['Morning adhkar', 1, ''],
  ],
  'demo-yusuf': [
    ['Hifz revision', 2, 'pages'],
    ['Istighfar', 100, 'times'],
  ],
  'demo-maryam': [
    ['تلاوتِ قرآن', 1, 'پارہ'],
    ['درود شریف', 300, 'مرتبہ'],
    ['سورۃ الملک', 1, ''],
  ],
  'demo-bilal': [
    ['Quran', 5, 'pages'],
    ['Tahajjud', 2, 'rakat'],
    ['Tasbeeh Fatima', 1, ''],
  ],
};

// deterministic pseudo-random
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Auth users (Google provider so they show in the emulator's Google sign-in popup)
try {
  await auth.deleteUsers(people.map((p) => p.uid));
} catch {}
const res = await auth.importUsers(
  people.map((p) => ({
    uid: p.uid,
    email: p.email,
    emailVerified: true,
    displayName: p.name,
    providerData: [{ uid: `google-${p.uid}`, email: p.email, displayName: p.name, providerId: 'google.com' }],
  })),
);
if (res.failureCount) console.warn('importUsers failures', res.errors);

await db.doc('settings/app').set({
  backfillDays: 2,
  weekStart: 1,
  timezone: tz,
  utcOffsetMinutes: 0,
  attentionThreshold: 60,
  attentionNoLogDays: 3,
  defaultReminderTime: '20:00',
  fajrReportTime: '08:00',
});
// Yusuf is Class A's Fajr monitor: he sees the class's daily Fajr roll (Salah tab).
await db.doc('classes/demo-class-a').set({ name: 'Class A — Girls', fajrMonitorId: 'demo-yusuf', fajrMonitorName: 'Yusuf Ali' });
await db.doc('classes/demo-class-b').set({ name: 'Class B — Boys' });

for (const p of people) {
  await db.doc(`users/${p.uid}`).set({
    name: p.name,
    email: p.email,
    photoURL: null,
    role: p.role,
    status: p.status,
    classId: p.classId,
    requestedClassId: p.status === 'pending' ? 'demo-class-b' : p.classId,
    signupComplete: true,
    reminderEnabled: false,
    reminderTime: null,
    onboarded: p.status === 'active',
    createdAt: Timestamp.now(),
  });
  const list = lists[p.uid];
  if (!list) continue;
  const ids = [];
  for (const [i, [name, target, unit]] of list.entries()) {
    const id = `m${i + 1}`;
    ids.push([id, target]);
    await db.doc(`users/${p.uid}/mamoolaat/${id}`).set({
      name, target, unit, active: true, order: i,
      createdBy: p.uid, createdAt: Timestamp.now(), createdDate: daysAgo(30),
      removedDate: null, updatedBy: p.uid, updatedAt: Timestamp.now(),
    });
  }
  // Bilal hasn't logged for a while -> shows in "needs attention"
  const diligence = { 'demo-aisha': 0.9, 'demo-yusuf': 0.6, 'demo-maryam': 0.8, 'demo-bilal': 0.4 }[p.uid];
  const skipRecent = p.uid === 'demo-bilal' ? 5 : 1; // nobody has logged today yet
  for (let d = 21; d >= skipRecent; d--) {
    if (rand() > diligence + 0.1) continue;
    const entries = {};
    for (const [id, target] of ids) {
      const r = rand();
      if (r < diligence) entries[id] = { status: 'done', amount: target, target };
      else if (r < diligence + 0.15) entries[id] = { status: 'partial', amount: Math.max(1, Math.round(target * 0.5)), target };
      else entries[id] = { status: 'missed', amount: 0, target };
    }
    await db.doc(`users/${p.uid}/logs/${daysAgo(d)}`).set({ date: daysAgo(d), entries, updatedAt: FieldValue.serverTimestamp() });
  }
}

// Salah for the last week (today included), and the matching Fajr roll entries.
const SALAH = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
const pickSalah = (good) => {
  const r = rand();
  return r < good * 0.6 ? 'takbir' : r < good ? 'jamaat' : r < good + 0.15 ? 'qadha' : 'missed';
};
for (const p of people.filter((x) => lists[x.uid])) {
  const good = { 'demo-aisha': 0.9, 'demo-yusuf': 0.7, 'demo-maryam': 0.6, 'demo-bilal': 0.4 }[p.uid];
  for (let d = 7; d >= 0; d--) {
    if (p.uid === 'demo-maryam' && d === 0) continue; // hasn't logged today: shows as "not logged"
    const entries = Object.fromEntries(SALAH.filter((_, i) => d > 0 || i === 0).map((n) => [n, pickSalah(good)]));
    await db.doc(`users/${p.uid}/salah/${daysAgo(d)}`).set({ date: daysAgo(d), entries, updatedAt: FieldValue.serverTimestamp() });
    await db.doc(`classes/${p.classId}/fajrRoll/${daysAgo(d)}`).set({ r: { [p.uid]: { name: p.name, status: entries.fajr } } }, { merge: true });
  }
}
for (const c of ['demo-class-a']) {
  const names = Object.fromEntries(people.filter((p) => p.classId === c && p.status === 'active').map((p) => [p.uid, p.name]));
  await db.doc(`classes/${c}/meta/roster`).set({ names });
}

await db.doc('users/demo-aisha/comments/welcome').set({
  text: 'MashaAllah, great consistency this week! Try to keep up the morning adhkar.',
  authorId: 'demo-admin',
  authorName: 'Demo Admin',
  createdAt: Timestamp.now(),
  readAt: null,
});
await db.collection('auditLog').add({
  actorId: 'demo-admin', actorName: 'Demo Admin', action: 'seed', details: { note: 'Emulator demo data' }, createdAt: Timestamp.now(),
});

console.log('Seeded demo data:');
for (const p of people) console.log(`  ${p.role.padEnd(7)} ${p.status.padEnd(7)} ${p.email}`);
process.exit(0);
