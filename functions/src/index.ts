/**
 * Mamulaat Cloud Functions (requires the Blaze plan — see README).
 *
 *  - sendDailyReminders: every 15 minutes, push "You haven't logged your
 *    mamoolaat today" to students whose reminder time has passed (in the
 *    project timezone) and who haven't logged anything yet today.
 *  - cleanupDeletedUser: when the admin deletes users/{uid}, remove any
 *    leftover sub-collections and the Firebase Auth account.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { DEAD_TOKEN_CODES, hasLogged, isDue, localNow, safeTz } from './reminders';

initializeApp();
const db = getFirestore();

const STALE_TOKEN_DAYS = 60;

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

      const tokenSnap = await u.ref.collection('fcmTokens').get();
      const staleBefore = Timestamp.fromMillis(Date.now() - STALE_TOKEN_DAYS * 86400000);
      const live = tokenSnap.docs.filter((t) => {
        const seen = t.get('lastSeen') as Timestamp | undefined;
        if (seen && seen < staleBefore) {
          void t.ref.delete();
          removed++;
          return false;
        }
        return true;
      });
      // Mark first, so a crash mid-send can't cause repeated pings.
      await u.ref.update({ lastReminderDate: today, lastReminderAt: FieldValue.serverTimestamp() });
      if (!live.length) continue;

      const res = await getMessaging().sendEachForMulticast({
        tokens: live.map((t) => t.id),
        data: {
          title: 'Mamulaat',
          body: "You haven't logged your mamoolaat today.",
          url: '.', // resolved against the service worker scope (works under a GitHub Pages sub-path)
          tag: `reminder-${today}`,
        },
        webpush: { headers: { Urgency: 'high', TTL: String(4 * 3600) } },
      });
      sent += res.successCount;
      await Promise.all(
        res.responses.map(async (r, i) => {
          if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
            removed++;
            await live[i].ref.delete();
          } else if (!r.success) {
            logger.warn('FCM send failed', { uid: u.id, code: r.error?.code });
          }
        }),
      );
    }
    logger.info('reminders run', { today, tz, candidates: users.size, sent, removedTokens: removed });
  },
);

export const cleanupDeletedUser = onDocumentDeleted({ document: 'users/{uid}', region: 'us-central1' }, async (event) => {
  const uid = event.params.uid;
  await db.recursiveDelete(db.doc(`users/${uid}`));
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw e;
  }
  logger.info('deleted user data and auth account', { uid });
});
