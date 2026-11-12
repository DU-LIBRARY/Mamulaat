// Sends Mamulaat's push notifications. Run every 15 minutes by .github/workflows/notifications.yml,
// so nothing needs Cloud Functions or the Blaze plan.
//
//  - Reminders: the fixed times in push.config.json (project timezone): 07:15 Fajr (skips anyone
//    who has logged Fajr), 23:00 daily, Fridays 12:00. Sent to every active student whose phone
//    has notifications on.
//  - Nudge: when the admin taps "send reminder" (nudges/{uid}_{day}), on the next run.
//  - Message: a note from the admin with "also send to their phone" ticked (pushMessages/{id}).
//  - New sign-up: tells every admin when a student finishes signing up.
//  - Approved: tells a student when the admin approves them.
//  - Fajr roll: each morning (settings.fajrReportTime) tells each Fajr monitor, for every class
//    they look after (combined), how many missed Fajr (incl. qadha) or haven't logged it. Also keeps each such
//    class's roster (names of its active students) current for the monitor's screen.
//  - Unlogged Fajr: from 12:00 (project time), every active student with no Fajr logged today
//    gets it recorded as missed (their salah record and their class's Fajr register). Logging
//    Jamaat later simply replaces it.
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON key (the same secret the backend deploy uses)
//   VAPID_PRIVATE_KEY         private half of the key pair whose public half is in push.config.json
//   TEST                      optional: "admins" or "all" sends a test notification instead
//   DRY_RUN                   optional: "true" only logs what would be sent
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import webpush from 'web-push';
import { dueSlots, fajrReport, hasLogged, localNow, safeTz, userChangeNotice } from '../../functions/src/reminders.ts';

const addDaysYmd = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

const CFG = JSON.parse(readFileSync(new URL('../../push.config.json', import.meta.url), 'utf8'));
const { FIREBASE_SERVICE_ACCOUNT, VAPID_PRIVATE_KEY, TEST = '', DRY_RUN = '' } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT || !VAPID_PRIVATE_KEY) {
  console.log('::warning::Secrets FIREBASE_SERVICE_ACCOUNT and VAPID_PRIVATE_KEY are not both set, so no notifications were sent. See README → Notifications.');
  process.exit(0);
}
const dry = DRY_RUN === '1' || DRY_RUN === 'true';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
webpush.setVapidDetails(CFG.subject, CFG.publicKey, VAPID_PRIVATE_KEY.trim());

const STALE_DAYS = 60; // a device not seen for this long has probably stopped using the app
const stats = { sent: 0, removed: 0, failed: 0 };

/** Send to every device of one user; drops subscriptions the push service says are gone. */
async function pushToUser(uid, msg) {
  const subs = await db.collection(`users/${uid}/pushSubs`).get();
  const staleBefore = Date.now() - STALE_DAYS * 86400e3;
  let ok = false;
  for (const s of subs.docs) {
    const v = s.data();
    if (v.lastSeen && v.lastSeen.toMillis() < staleBefore) {
      if (!dry) await s.ref.delete();
      stats.removed++;
      continue;
    }
    if (dry) {
      console.log(`[dry run] ${uid} ← ${msg.title}: ${msg.body}`);
      ok = true;
      continue;
    }
    try {
      await webpush.sendNotification({ endpoint: v.endpoint, keys: { p256dh: v.p256dh, auth: v.auth } }, JSON.stringify(msg), { TTL: 4 * 3600, urgency: 'high' });
      stats.sent++;
      ok = true;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        stats.removed++;
        await s.ref.delete(); // unsubscribed, or the app was removed from the phone
      } else {
        stats.failed++;
        console.log(`::warning::push to ${uid}/${s.id} failed: ${e.statusCode || ''} ${e.body || e.message}`);
      }
    }
  }
  return ok;
}

const users = await db.collection('users').get();
const byId = new Map(users.docs.map((d) => [d.id, d.data()]));
const admins = users.docs.filter((d) => d.get('role') === 'admin' && d.get('status') === 'active').map((d) => d.id);

// TEST=fajr: every Fajr monitor gets a sample morning report with made-up numbers, clearly marked
// as a test. Reads class names and monitors only; writes nothing.
if (TEST === 'fajr') {
  const classes = await db.collection('classes').get();
  const byMonitor = new Map();
  for (const c of classes.docs) {
    const m = c.get('fajrMonitorId');
    if (typeof m !== 'string' || byId.get(m)?.status !== 'active') continue;
    byMonitor.set(m, [...(byMonitor.get(m) ?? []), typeof c.get('name') === 'string' ? c.get('name') : 'Class']);
  }
  for (const [uid, names] of byMonitor) {
    const body = '8 missed';
    const ok = await pushToUser(uid, { title: 'TEST · Fajr today (sample numbers)', body, url: 'salah/fajr', tag: 'fajr-test' });
    console.log(`Fajr test → ${byId.get(uid)?.name ?? uid} (${names.length} class(es)): ${ok ? 'sent' : 'NOT sent (no device with notifications on)'}`);
  }
  if (!byMonitor.size) console.log('::warning::No class has an active Fajr monitor.');
  console.log(`Fajr test: sent ${stats.sent}, removed ${stats.removed} expired device(s), ${stats.failed} failed.`);
  process.exit(0);
}

// TEST=fajr-reminder: send the Fajr reminder now to every active student and list who it
// couldn't reach (no phone with notifications turned on). Writes nothing.
if (TEST === 'fajr-reminder') {
  const slot = (CFG.reminders ?? []).find((r) => r.fajr) ?? { title: 'Fajr', body: 'Please log your Fajr salah for today.', url: 'salah' };
  const reached = [];
  const unreached = [];
  for (const [uid, d] of byId) {
    if (d.role !== 'student' || d.status !== 'active') continue;
    const name = typeof d.name === 'string' && d.name ? d.name : uid;
    if (await pushToUser(uid, { title: `TEST · ${slot.title || 'Fajr'}`, body: slot.body, url: slot.url || '.', tag: 'fajr-reminder-test' })) reached.push(name);
    else unreached.push(name);
  }
  console.log(`Fajr reminder test: reached ${reached.length} of ${reached.length + unreached.length} active student(s).`);
  if (unreached.length) console.log(`Not reached (notifications not turned on in the app): ${unreached.sort().join(', ')}`);
  console.log(`Sent ${stats.sent} push(es) to ${reached.length} student(s); removed ${stats.removed} expired device(s); ${stats.failed} failed.`);
  process.exit(0);
}

if (TEST === 'admins' || TEST === 'all') {
  const uids = TEST === 'all' ? [...byId.keys()] : admins;
  for (const uid of uids) await pushToUser(uid, { title: 'Mamūlāt', body: 'Test notification: notifications are working.', url: '.', tag: 'test' });
  console.log(`Test (${TEST}): sent ${stats.sent}, removed ${stats.removed} expired device(s), ${stats.failed} failed.`);
  process.exit(0);
}

const settings = (await db.doc('settings/app').get()).data() ?? {};
const tz = safeTz(settings.timezone);
const { date: today, minutes } = localNow(tz);

// 1. Reminders at fixed times (push.config.json → reminders, project timezone): one general
// message to every active student who has reminders turned on.
const remindersRef = db.doc('pushState/reminders');
const sentSlots = (await remindersRef.get()).data()?.sent ?? {};
let reminded = 0;
for (const { slot, key } of dueSlots(CFG.reminders ?? [], today, minutes, sentSlots)) {
  sentSlots[key] = Date.now(); // record first, so a crash can't cause repeated pings
  if (!dry) await remindersRef.set({ sent: Object.fromEntries(Object.entries(sentSlots).filter(([k]) => k >= addDaysYmd(today, -7))) });
  let n = 0;
  const unreached = [];
  for (const [uid, d] of byId) {
    if (d.role !== 'student' || d.status !== 'active') continue;
    if (slot.fajr && (await db.doc(`users/${uid}/salah/${today}`).get()).get('entries.fajr')) continue; // already logged
    if (await pushToUser(uid, { title: slot.title || 'Mamūlāt', body: slot.body, url: slot.url || '.', tag: `reminder-${key}` })) n++;
    else unreached.push(typeof d.name === 'string' && d.name ? d.name : uid);
  }
  if (unreached.length) console.log(`  not reached (notifications off on their phone): ${unreached.length}`);
  reminded += n;
  console.log(`Reminder ${key}: sent to ${n} student(s)`);
}

// 2. Nudges from the admin ("please log today")
let nudged = 0;
const nudges = await db.collection('nudges').where('day', '==', today).get();
for (const n of nudges.docs) {
  const v = n.data();
  if (v.pushedAt || typeof v.uid !== 'string') continue;
  const user = byId.get(v.uid);
  const log = user?.status === 'active' ? await db.doc(`users/${v.uid}/logs/${v.day}`).get() : null;
  if (log && !hasLogged(log.data())) {
    if (await pushToUser(v.uid, { title: 'Reminder from your teacher', body: 'Please log your mamoolaat for today.', url: '.', tag: `nudge-${v.day}` })) nudged++;
  }
  if (!dry) await n.ref.update({ pushedAt: admin.firestore.FieldValue.serverTimestamp() });
}

// 2b. Messages from the admin (a note on the student's page with "send to their phone" ticked)
let messages = 0;
const pushMessages = await db.collection('pushMessages').get();
for (const m of pushMessages.docs) {
  const v = m.data();
  if (typeof v.uid === 'string' && typeof v.text === 'string' && byId.get(v.uid)) {
    const from = typeof v.actorName === 'string' && v.actorName ? v.actorName : 'your teacher';
    if (await pushToUser(v.uid, { title: `Message from ${from}`, body: v.text, url: '.', tag: `msg-${m.id}` })) messages++;
  }
  if (!dry) await m.ref.delete(); // sent (or nobody to send to): done
}

// 3 + 4. New sign-ups (→ admins) and approvals (→ the student). Without database triggers we compare
// with what earlier runs saw, kept in pushState/notices (no app user can read or write it).
const stateRef = db.doc('pushState/notices');
const state = (await stateRef.get()).data() ?? {};
const seenSignups = { ...(state.signups ?? {}) };
const seenActive = { ...(state.active ?? {}) };
const firstRun = !state.initialized;
let signups = 0;
let approvals = 0;
for (const [uid, d] of byId) {
  if (userChangeNotice({ signupComplete: false }, d) === 'admin-signup' && !seenSignups[uid]) {
    seenSignups[uid] = Date.now();
    const cls = typeof d.requestedClassId === 'string' && d.requestedClassId ? String((await db.doc(`classes/${d.requestedClassId}`).get()).get('name') ?? '') : '';
    const name = typeof d.name === 'string' && d.name ? d.name : 'Someone';
    for (const a of admins) await pushToUser(a, { title: 'New sign-up waiting', body: cls ? `${name} wants to join ${cls}.` : `${name} is waiting for approval.`, url: 'admin/students', tag: `signup-${uid}` });
    signups++;
  }
  if (d.role === 'student' && d.status === 'active' && !seenActive[uid]) {
    seenActive[uid] = Date.now();
    // On the very first run, everyone already active is just recorded, not told they were approved.
    if (!firstRun) {
      await pushToUser(uid, { title: 'You have been approved', body: 'Open Mamūlāt to set up your daily mamoolaat.', url: '.', tag: 'approved' });
      approvals++;
    }
  }
  if (d.status !== 'pending') delete seenSignups[uid]; // decided: a later re-request notifies again
}
for (const uid of Object.keys(seenActive)) {
  const d = byId.get(uid);
  if (!d || d.status !== 'active') delete seenActive[uid]; // deactivated / deleted: re-approval notifies again
}
if (!dry) await stateRef.set({ initialized: true, signups: seenSignups, active: seenActive, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

// 5. Fajr roll → Fajr monitors, once a day at settings.fajrReportTime. One monitor may look after
// several classes; they get a single push with a line per class.
let fajrReports = 0;
const classes = await db.collection('classes').get();
const byMonitor = new Map(); // monitor uid → [{ name, report }]
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
for (const c of classes.docs) {
  const monitor = c.get('fajrMonitorId');
  if (typeof monitor !== 'string' || !monitor) continue;
  const roster = Object.fromEntries(
    [...byId].filter(([, d]) => d.role === 'student' && d.status === 'active' && d.classId === c.id).map(([uid, d]) => [uid, typeof d.name === 'string' && d.name ? d.name : d.email ?? 'Unnamed']),
  );
  // Keep the roster the monitor's screen reads in step (written only when it changed).
  const rosterRef = db.doc(`classes/${c.id}/meta/roster`);
  const saved = (await rosterRef.get()).data()?.names ?? {};
  if (!same(saved, roster) && !dry) await rosterRef.set({ names: roster });
  if (byId.get(monitor)?.status !== 'active') continue;
  const roll = (await db.doc(`classes/${c.id}/fajrRoll/${today}`).get()).data();
  const list = byMonitor.get(monitor) ?? [];
  list.push({ name: typeof c.get('name') === 'string' ? c.get('name') : 'Class', report: fajrReport(roster, roll) });
  byMonitor.set(monitor, list);
}
const fajrRef = db.doc('pushState/fajr');
const fajrSent = (await fajrRef.get()).data()?.sent ?? {};
const fajrTime = typeof settings.fajrReportTime === 'string' ? settings.fajrReportTime : '08:00';
for (const [monitor, list] of byMonitor) {
  const sentForMonitor = Object.fromEntries(Object.entries(fajrSent).filter(([k]) => k.startsWith(`${monitor} `)).map(([k, v]) => [k.slice(monitor.length + 1), v]));
  const due = dueSlots([{ time: fajrTime, body: '' }], today, minutes, sentForMonitor);
  if (!due.length) continue;
  fajrSent[`${monitor} ${due[0].key}`] = Date.now(); // record first, so a crash can't cause repeated pings
  if (!dry) await fajrRef.set({ sent: Object.fromEntries(Object.entries(fajrSent).filter(([k]) => k.split(' ')[1] >= addDaysYmd(today, -7))) });
  // One line across all their classes; missed includes qadha and not logged.
  const missed = list.reduce((n, x) => n + x.report.missed + x.report.qadha + x.report.notLogged, 0);
  const body = `${missed} missed`;
  const title = 'Fajr today';
  if (await pushToUser(monitor, { title, body, url: 'salah/fajr', tag: `fajr-${today}` })) fajrReports++;
}

// 6. From midday (project time), today's Fajr not logged is recorded as missed for every active
// student, in their own salah record and in their class's Fajr register, exactly as if they had
// tapped Missed. It only fills a Fajr that's still empty, so a student who logs Jamaat later simply
// replaces it. Runs on every pass after midday, so students activated later are covered too.
const FAJR_AUTO_MISSED_AT = 12 * 60;
let autoMissed = 0;
if (minutes >= FAJR_AUTO_MISSED_AT) {
  for (const [uid, d] of byId) {
    if (d.role !== 'student' || d.status !== 'active') continue;
    const salahRef = db.doc(`users/${uid}/salah/${today}`);
    const classId = typeof d.classId === 'string' && d.classId ? d.classId : null;
    const name = (typeof d.name === 'string' && d.name ? d.name : d.email ?? 'Unnamed').slice(0, 200);
    if (dry) {
      if (!(await salahRef.get()).data()?.entries?.fajr) {
        autoMissed++;
        console.log(`[dry run] would mark Fajr missed for ${name}`);
      }
      continue;
    }
    // In a transaction, so a Fajr the student logs at the same moment always wins.
    const marked = await db.runTransaction(async (tx) => {
      const snap = await tx.get(salahRef);
      if (snap.data()?.entries?.fajr) return false;
      tx.set(salahRef, { date: today, entries: { fajr: 'missed' }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (classId) tx.set(db.doc(`classes/${classId}/fajrRoll/${today}`), { r: { [uid]: { name, status: 'missed' } } }, { merge: true });
      return true;
    });
    if (marked) autoMissed++;
  }
}

console.log(
  `${today} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${tz}: ` +
    `${reminded} reminder(s), ${nudged} nudge(s), ${messages} message(s), ${signups} sign-up notice(s), ${approvals} approval(s), ${fajrReports} Fajr report(s), ${autoMissed} unlogged Fajr marked missed${firstRun ? ' (first run: existing students recorded)' : ''}. ` +
    `Sent ${stats.sent} push(es); removed ${stats.removed} expired device(s); ${stats.failed} failed.`,
);
