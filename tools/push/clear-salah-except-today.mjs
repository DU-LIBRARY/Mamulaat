// One-off: permanently deletes every student's salah records (users/*/salah/{day}) and every
// class's Fajr register (classes/*/fajrRoll/{day}) for every day EXCEPT today (project timezone).
// Keeps today's records and everything else. Run by .github/workflows/clear-salah-except-today.yml,
// which asks for "DELETE".
import admin from 'firebase-admin';
import { localNow, safeTz } from '../../functions/src/reminders.ts';

const { FIREBASE_SERVICE_ACCOUNT, CONFIRM = '' } = process.env;
if (CONFIRM !== 'DELETE') {
  console.log('::error::Type DELETE in the confirm box to run this.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const settings = (await db.doc('settings/app').get()).data() ?? {};
const tz = safeTz(settings.timezone);
const { date: today } = localNow(tz);
console.log(`Keeping ${today} (${tz}); deleting every other day.`);

async function clearExceptToday(col) {
  let n = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (const ref of await col.listDocuments()) {
    if (ref.id === today) continue;
    batch.delete(ref);
    n++;
    if (++inBatch === 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch) await batch.commit();
  return n;
}

let salahDocs = 0;
let rollDocs = 0;
for (const u of (await db.collection('users').get()).docs) salahDocs += await clearExceptToday(u.ref.collection('salah'));
for (const c of (await db.collection('classes').get()).docs) rollDocs += await clearExceptToday(c.ref.collection('fajrRoll'));

await db.collection('auditLog').add({
  actorId: 'github-action',
  actorName: 'Clear salah job',
  action: 'salah.clearExceptToday',
  details: { kept: today, salahDays: salahDocs, fajrRegisterDays: rollDocs },
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
console.log(`Deleted ${salahDocs} student salah day(s) and ${rollDocs} Fajr register day(s); kept ${today}.`);
