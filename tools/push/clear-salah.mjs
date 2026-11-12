// One-off: permanently deletes every student's salah records (users/*/salah) and every class's
// Fajr register (classes/*/fajrRoll). Keeps classes, students, mamoolaat, logs, Fajr monitors,
// class lists and settings. Run by .github/workflows/clear-salah.yml, which asks for "DELETE".
import admin from 'firebase-admin';

const { FIREBASE_SERVICE_ACCOUNT, CONFIRM = '' } = process.env;
if (CONFIRM !== 'DELETE') {
  console.log('::error::Type DELETE in the confirm box to run this.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

let salahDocs = 0;
let rollDocs = 0;
for (const u of (await db.collection('users').get()).docs) {
  const col = u.ref.collection('salah');
  const n = (await col.count().get()).data().count;
  if (n) {
    await db.recursiveDelete(col);
    salahDocs += n;
  }
}
for (const c of (await db.collection('classes').get()).docs) {
  const col = c.ref.collection('fajrRoll');
  const n = (await col.count().get()).data().count;
  if (n) {
    await db.recursiveDelete(col);
    rollDocs += n;
  }
}
await db.collection('auditLog').add({
  actorId: 'github-action',
  actorName: 'Clear salah job',
  action: 'salah.clearAll',
  details: { salahDays: salahDocs, fajrRegisterDays: rollDocs },
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
console.log(`Deleted ${salahDocs} student salah day(s) and ${rollDocs} Fajr register day(s).`);
