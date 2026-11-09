// Sends Mamulaat's push notifications. Run every 15 minutes by .github/workflows/notifications.yml,
// so nothing needs Cloud Functions or the Blaze plan.
//
//  - Reminders: a general "please log" message at the fixed times in push.config.json (every day
//    at 23:00, and Fridays at 12:00, project timezone) to students who turned reminders on.
//  - Nudge: when the admin taps "send reminder" (nudges/{uid}_{day}), on the next run.
//  - Message: a note from the admin with "also send to their phone" ticked (pushMessages/{id}).
//  - New sign-up: tells every admin when a student finishes signing up.
//  - Approved: tells a student when the admin approves them.
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON key (the same secret the backend deploy uses)
//   VAPID_PRIVATE_KEY         private half of the key pair whose public half is in push.config.json
//   TEST                      optional: "admins" or "all" sends a test notification instead
//   DRY_RUN                   optional: "true" only logs what would be sent
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import webpush from 'web-push';
import { dueSlots, hasLogged, localNow, safeTz, userChangeNotice } from '../../functions/src/reminders.ts';

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
  for (const [uid, d] of byId) {
    if (d.role !== 'student' || d.status !== 'active' || d.reminderEnabled !== true) continue;
    if (await pushToUser(uid, { title: slot.title || 'Mamūlāt', body: slot.body, url: '.', tag: `reminder-${key}` })) n++;
  }
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

console.log(
  `${today} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${tz}: ` +
    `${reminded} reminder(s), ${nudged} nudge(s), ${messages} message(s), ${signups} sign-up notice(s), ${approvals} approval(s)${firstRun ? ' (first run: existing students recorded)' : ''}. ` +
    `Sent ${stats.sent} push(es); removed ${stats.removed} expired device(s); ${stats.failed} failed.`,
);
