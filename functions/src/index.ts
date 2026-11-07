/**
 * Mamulaat Cloud Functions (requires the Blaze plan — see README).
 *
 *  - sendDailyReminders: every 15 minutes, push "You haven't logged your
 *    mamoolaat today" to students whose reminder time has passed (in the
 *    project timezone) and who haven't logged anything yet today.
 *  - sendNudge: when the admin nudges a student (nudges/{uid}_{day}), push
 *    "please log today" to that student straight away.
 *  - notifyUserChange: tell the admin when someone finishes signing up, and
 *    tell a student when they are approved.
 *  - cleanupDeletedUser: when the admin deletes users/{uid}, remove any
 *    leftover sub-collections, nudges and the Firebase Auth account.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { DEAD_TOKEN_CODES, hasLogged, isDue, localNow, safeTz, userChangeNotice } from './reminders';

initializeApp();
const db = getFirestore();

const STALE_TOKEN_DAYS = 60;

/**
 * Send a data-only push to every device of one user, deleting dead or stale tokens.
 * `url` is resolved against the service-worker scope (works under a GitHub Pages sub-path).
 */
async function pushToUser(uid: string, msg: { title: string; body: string; url: string; tag: string }) {
  const ref = db.doc(`users/${uid}`);
  const tokenSnap = await ref.collection('fcmTokens').get();
  const staleBefore = Timestamp.fromMillis(Date.now() - STALE_TOKEN_DAYS * 86400000);
  let removed = 0;
  const live = tokenSnap.docs.filter((t) => {
    const seen = t.get('lastSeen') as Timestamp | undefined;
    if (seen && seen < staleBefore) {
      void t.ref.delete();
      removed++;
      return false;
    }
    return true;
  });
  if (!live.length) return { sent: 0, removed };
  const res = await getMessaging().sendEachForMulticast({
    tokens: live.map((t) => t.id),
    data: msg,
    webpush: { headers: { Urgency: 'high', TTL: String(4 * 3600) } },
  });
  await Promise.all(
    res.responses.map(async (r, i) => {
      if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
        removed++;
        await live[i].ref.delete();
      } else if (!r.success) {
        logger.warn('FCM send failed', { uid, code: r.error?.code });
      }
    }),
  );
  return { sent: res.successCount, removed };
}

export const sendDailyReminders = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'UTC', region: 'us-central1', memory: '256MiB', timeoutSeconds: 120, retryCount: 0 },
  async () => {
    const settings = (await db.doc('settings/app').get()).data() ?? {};
    const tz = safeTz(settings.timezone);
    const { date: today, minutes } = localNow(tz);

    const users = await db
      .collection('users')
      .where('role', '==', 'student')
      .where('status', '==', 'active')
      .where('reminderEnabled', '==', true)
      .get();

    let sent = 0;
    let removed = 0;
    for (const u of users.docs) {
      const d = u.data();
      if (!isDue({ reminderTime: d.reminderTime, defaultTime: settings.defaultReminderTime, nowMinutes: minutes, today, lastReminderDate: d.lastReminderDate })) continue;

      const log = await u.ref.collection('logs').doc(today).get();
      if (hasLogged(log.data())) {
        await u.ref.update({ lastReminderDate: today }); // logged already: nothing to send today
        continue;
      }

      // Mark first, so a crash mid-send can't cause repeated pings.
      await u.ref.update({ lastReminderDate: today, lastReminderAt: FieldValue.serverTimestamp() });
      const r = await pushToUser(u.id, {
        title: 'Mamulaat',
        body: "You haven't logged your mamoolaat today.",
        url: '.',
        tag: `reminder-${today}`,
      });
      sent += r.sent;
      removed += r.removed;
    }
    logger.info('reminders run', { today, tz, candidates: users.size, sent, removedTokens: removed });
  },
);

export const sendNudge = onDocumentCreated({ document: 'nudges/{id}', region: 'us-central1' }, async (event) => {
  const d = event.data?.data();
  if (!d || typeof d.uid !== 'string') return;
  const user = (await db.doc(`users/${d.uid}`).get()).data();
  if (!user || user.status !== 'active') return;
  // Already logged since the nudge was sent? Then there is nothing to remind about.
  const log = await db.doc(`users/${d.uid}/logs/${d.day}`).get();
  if (hasLogged(log.data())) return;
  const r = await pushToUser(d.uid, {
    title: 'Reminder from your teacher',
    body: 'Please log your mamoolaat for today.',
    url: '.',
    tag: `nudge-${d.day}`,
  });
  logger.info('nudge sent', { uid: d.uid, day: d.day, ...r });
});

export const notifyUserChange = onDocumentUpdated({ document: 'users/{uid}', region: 'us-central1' }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const kind = userChangeNotice(before, after);
  if (!kind || !after) return;
  const uid = event.params.uid;
  if (kind === 'student-approved') {
    await pushToUser(uid, {
      title: 'You have been approved',
      body: 'Open Mamulaat to set up your daily mamoolaat.',
      url: '.',
      tag: 'approved',
    });
    return;
  }
  const admins = await db.collection('users').where('role', '==', 'admin').where('status', '==', 'active').get();
  let cls = '';
  if (typeof after.requestedClassId === 'string' && after.requestedClassId) {
    cls = String((await db.doc(`classes/${after.requestedClassId}`).get()).get('name') ?? '');
  }
  const name = typeof after.name === 'string' && after.name ? after.name : 'Someone';
  for (const a of admins.docs) {
    await pushToUser(a.id, {
      title: 'New sign-up waiting',
      body: cls ? `${name} wants to join ${cls}.` : `${name} is waiting for approval.`,
      url: 'admin/students',
      tag: 'signup',
    });
  }
});

export const cleanupDeletedUser = onDocumentDeleted({ document: 'users/{uid}', region: 'us-central1' }, async (event) => {
  const uid = event.params.uid;
  await db.recursiveDelete(db.doc(`users/${uid}`));
  const nudges = await db.collection('nudges').where('uid', '==', uid).get();
  await Promise.all(nudges.docs.map((n) => n.ref.delete()));
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw e;
  }
  logger.info('deleted user data and auth account', { uid });
});
