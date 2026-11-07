/**
 * ONE-OFF: make an existing, signed-up user the first admin.
 *
 * The user must have signed in to the app once (so users/{uid} exists as "pending").
 * This uses the Firebase Admin SDK, which bypasses security rules, so it needs
 * Google Cloud credentials for the Mamulaat project (only project Owners/Editors
 * have them). Nothing in the app or rules grants admin by email.
 *
 * Optional: --timezone Asia/Karachi (initial project timezone).
 *
 * Usage (real project):
 *   gcloud auth application-default login          # or GOOGLE_APPLICATION_CREDENTIALS=service-account.json
 *   node scripts/bootstrap-admin.mjs --project your-mamulaat-project --email you@example.com
 *
 * Usage (emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/bootstrap-admin.mjs --project demo-mamulaat --email you@example.com
 *
 * It refuses to run if an admin already exists (use the in-app "Transfer admin" instead).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const projectId = args.project ?? process.env.GCLOUD_PROJECT;
const email = args.email;
if (!projectId || !email) {
  console.error('Usage: node scripts/bootstrap-admin.mjs --project <project-id> --email <user-email>');
  process.exit(1);
}

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(emulator ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore();

const existing = await db.collection('users').where('role', '==', 'admin').get();
if (!existing.empty) {
  console.error(`An admin already exists (${existing.docs.map((d) => d.get('email')).join(', ')}). Use "Transfer admin" in the app.`);
  process.exit(1);
}

let uid;
try {
  uid = (await getAuth().getUserByEmail(email)).uid;
} catch {
  const q = await db.collection('users').where('email', '==', email).limit(1).get();
  uid = q.docs[0]?.id;
}
if (!uid) {
  console.error(`No user found for ${email}. Sign in to the app once first, then re-run.`);
  process.exit(1);
}
const ref = db.doc(`users/${uid}`);
if (!(await ref.get()).exists) {
  console.error(`users/${uid} doesn't exist yet. Open the app and sign in once, then re-run.`);
  process.exit(1);
}

await db.runTransaction(async (tx) => {
  const settings = await tx.get(db.doc('settings/app'));
  tx.update(ref, { role: 'admin', status: 'active', classId: null });
  if (!settings.exists) {
    // Defaults; the admin's browser corrects utcOffsetMinutes for the chosen timezone.
    tx.set(db.doc('settings/app'), {
      backfillDays: 2, weekStart: 1, timezone: args.timezone ?? 'UTC', utcOffsetMinutes: 0,
      attentionThreshold: 60, attentionNoLogDays: 3, defaultReminderTime: '20:00',
    });
  }
  tx.set(db.collection('auditLog').doc(), {
    actorId: 'bootstrap-script', actorName: 'bootstrap-admin.mjs', action: 'admin.bootstrap',
    details: { uid, email }, createdAt: FieldValue.serverTimestamp(),
  });
});
console.log(`✓ ${email} (${uid}) is now the admin of ${projectId}.`);
console.log('  Open the app, go to Admin → Settings and set the project timezone.');
process.exit(0);
