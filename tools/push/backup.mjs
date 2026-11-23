// Encrypted Firestore backups, run by .github/workflows/backup.yml (weekly) and restore.yml.
//
//   node tools/push/backup.mjs backup  <prevDir> <outFile>   take this week's backup
//   node tools/push/backup.mjs restore <file>                write a backup back into Firestore
//   node tools/push/backup.mjs decrypt <file> <out.json>     decrypt a backup on your own computer
//
// The repository is public, and GitHub lets any signed-in user download a public repository's
// artifacts, so a backup NEVER leaves the job unencrypted: it is gzipped JSON sealed with
// AES-256-GCM under a key derived (scrypt) from the BACKUP_PASSPHRASE secret. Without that
// secret the job refuses to run. The job's log shows only counts, never names or records.
//
// Each backup is COMPLETE (restorable on its own) but is built from the previous one plus what
// changed since, so the weekly run stays far inside the free plan's 50,000 reads a day:
//   - read in full every week (small): users, each user's mamoolaat / comments / changes,
//     classes and their meta docs, settings and the other small top-level collections;
//   - read only if changed: each user's logs and salah (updatedAt since the last backup, less a
//     day's margin), the audit log (createdAt since then), and the last 45 days of Fajr rolls.
// A student or class that has been deleted is dropped from the next backup (deleting a student
// is meant to remove their data); older backups keep it until they expire after 90 days.
// Device push keys (pushSubs, fcmTokens) and queued pushes (pushMessages) are not backed up.
//
// Env: FIREBASE_SERVICE_ACCOUNT, BACKUP_PASSPHRASE; for restore also RESTORE_MODE
// ("missing" = only documents that no longer exist, the default; "overwrite" = every document)
// and RESTORE_PREFIX (optional, e.g. "users/<uid>" to restore one student).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const MAGIC = Buffer.from('MAMBAK1\n');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const SKIP_SUB = new Set(['pushSubs', 'fcmTokens']);
const SKIP_ROOT = new Set(['pushMessages']);
const DAY_RECORDS = new Set(['logs', 'salah']);
const ROLL_DAYS = 45;

const [cmd, a1, a2] = process.argv.slice(2);
const pass = process.env.BACKUP_PASSPHRASE ?? '';
if (pass.length < 16) {
  console.log('::error::The BACKUP_PASSPHRASE secret is missing or shorter than 16 characters. Nothing was backed up or restored. See README → Backups.');
  process.exit(1);
}

// ---------- encryption ----------
function seal(obj) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(pass, salt, 32, SCRYPT);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(obj)))), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}
function open(buf) {
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a Mamulaat backup file.');
  let o = MAGIC.length;
  const salt = buf.subarray(o, (o += 16));
  const iv = buf.subarray(o, (o += 12));
  const tag = buf.subarray(o, (o += 16));
  const d = createDecipheriv('aes-256-gcm', scryptSync(pass, salt, 32, SCRYPT), iv);
  d.setAuthTag(tag);
  try {
    return JSON.parse(gunzipSync(Buffer.concat([d.update(buf.subarray(o)), d.final()])).toString('utf8'));
  } catch {
    throw new Error('Could not decrypt the backup: wrong BACKUP_PASSPHRASE, or the file is damaged.');
  }
}

if (cmd === 'decrypt') {
  writeFileSync(a2, JSON.stringify(open(readFileSync(a1)), null, 1));
  console.log(`Decrypted to ${a2}.`);
  process.exit(0);
}

// ---------- optional copy to Google Drive ----------
// Uploads the (already encrypted) file into a "Mamulaat backups" folder in the owner's Drive,
// where it stays until they delete it. Uses an OAuth refresh token with the drive.file scope,
// which lets this script see and touch ONLY the files and folder it created, nothing else in
// the Drive. Skipped (with a note) unless GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET and
// GDRIVE_REFRESH_TOKEN are all set.
if (cmd === 'drive') {
  const { GDRIVE_CLIENT_ID: id, GDRIVE_CLIENT_SECRET: secret, GDRIVE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) {
    console.log('Google Drive copy skipped: the GDRIVE_* secrets are not set (optional, see README → Backups).');
    process.exit(0);
  }
  const ok = async (r, what) => {
    if (!r.ok) throw new Error(`${what} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r;
  };
  const tok = await (
    await ok(
      await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
      }),
      'Google sign-in (check the GDRIVE_* secrets; a refresh token from an app left in "Testing" expires after 7 days)',
    )
  ).json();
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  const FOLDER = 'Mamulaat backups';
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await (await ok(await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: auth }), 'Finding the folder')).json();
  let folder = found.files?.[0]?.id;
  if (!folder) {
    const made = await ok(
      await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
      }),
      'Creating the folder',
    );
    folder = (await made.json()).id;
  }
  const name = a1.split('/').pop();
  const start = await ok(
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream' },
      body: JSON.stringify({ name, parents: [folder] }),
    }),
    'Starting the upload',
  );
  await ok(await fetch(start.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: readFileSync(a1) }), 'Uploading');
  console.log(`Copied ${name} to Google Drive → ${FOLDER}.`);
  process.exit(0);
}

// ---------- Firestore ----------
const { default: admin } = await import('firebase-admin');
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('::error::The FIREBASE_SERVICE_ACCOUNT secret is not set.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const { Timestamp, GeoPoint, DocumentReference, FieldPath } = admin.firestore;

/** Firestore values → plain JSON (and back), keeping timestamps, references and bytes exact. */
function enc(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint) return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (v instanceof DocumentReference) return { __t: 'ref', p: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'bytes', b: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(enc);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
}
function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec);
  if (v.__t === 'ts') return new Timestamp(v.s, v.n);
  if (v.__t === 'geo') return new GeoPoint(v.lat, v.lng);
  if (v.__t === 'ref') return db.doc(v.p);
  if (v.__t === 'bytes') return Buffer.from(v.b, 'base64');
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
}

if (cmd === 'restore') {
  const backup = open(readFileSync(a1));
  const mode = process.env.RESTORE_MODE === 'overwrite' ? 'overwrite' : 'missing';
  const prefix = (process.env.RESTORE_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '');
  const paths = Object.keys(backup.docs).filter((p) => !prefix || p === prefix || p.startsWith(`${prefix}/`));
  console.log(`Backup taken ${backup.takenAt}: ${Object.keys(backup.docs).length} documents; ${paths.length} match${prefix ? ' the prefix' : ''}. Mode: ${mode}.`);
  let written = 0;
  let kept = 0;
  const w = db.bulkWriter();
  for (let i = 0; i < paths.length; i += 300) {
    const chunk = paths.slice(i, i + 300);
    const exists = mode === 'missing' ? await db.getAll(...chunk.map((p) => db.doc(p))) : [];
    chunk.forEach((p, j) => {
      if (mode === 'missing' && exists[j].exists) return void kept++;
      w.set(db.doc(p), dec(backup.docs[p]));
      written++;
    });
  }
  await w.close();
  console.log(`Restored ${written} document(s)${mode === 'missing' ? `; left ${kept} that still exist untouched` : ''}.`);
  process.exit(0);
}

if (cmd !== 'backup') {
  console.log('Usage: backup <prevDir> <outFile> | restore <file> | decrypt <file> <out.json>');
  process.exit(1);
}

// ---------- backup ----------
/** The newest *.enc file in prevDir (downloaded from the last successful run), decrypted. */
function previous(dir) {
  if (!dir || !existsSync(dir)) return null;
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.enc')) files.push(p);
    }
  };
  walk(dir);
  if (!files.length) return null;
  files.sort();
  return open(readFileSync(files[files.length - 1]));
}

const prev = previous(a1);
const takenAt = new Date();
// A day's margin covers server timestamps written while the last backup was running.
const since = prev ? Timestamp.fromMillis(Date.parse(prev.takenAt) - 86400e3) : null;
const docs = {}; // path → encoded data, read this run
const fullCols = new Set(); // collections read in full: their old entries are replaced
let reads = 0;

async function readCol(ref, q = ref) {
  const s = await q.get();
  reads += Math.max(1, s.size);
  for (const d of s.docs) docs[d.ref.path] = enc(d.data());
  if (q === ref) fullCols.add(ref.path);
  return s.docs;
}

const roots = await db.listCollections();
for (const root of roots) {
  if (SKIP_ROOT.has(root.id)) continue;
  if (root.id === 'auditLog') {
    await readCol(root, since ? root.where('createdAt', '>=', since) : root);
    continue;
  }
  // listDocuments also finds parents that only hold subcollections.
  const refs = await root.listDocuments();
  await readCol(root);
  if (root.id !== 'users' && root.id !== 'classes') continue;
  for (const ref of refs) {
    for (const sub of await ref.listCollections()) {
      if (SKIP_SUB.has(sub.id)) continue;
      if (since && DAY_RECORDS.has(sub.id)) await readCol(sub, sub.where('updatedAt', '>=', since));
      else if (since && sub.id === 'fajrRoll') {
        const from = new Date(Date.now() - ROLL_DAYS * 86400e3).toISOString().slice(0, 10);
        await readCol(sub, sub.where(FieldPath.documentId(), '>=', from));
      } else await readCol(sub);
    }
  }
}

// Start from the previous backup, minus anyone or anything that no longer exists.
const merged = {};
const parentCol = (p) => p.slice(0, p.lastIndexOf('/'));
const live = (root) => new Set(Object.keys(docs).filter((p) => p.startsWith(`${root}/`)).map((p) => p.split('/')[1]));
const liveUsers = live('users');
const liveClasses = new Set([...live('classes')]);
let dropped = 0;
for (const [p, v] of Object.entries(prev?.docs ?? {})) {
  const [root, id] = p.split('/');
  if ((root === 'users' && !liveUsers.has(id)) || (root === 'classes' && !liveClasses.has(id))) {
    dropped++;
    continue;
  }
  if (fullCols.has(parentCol(p))) continue; // re-read in full this week: take the fresh copy
  merged[p] = v;
}
Object.assign(merged, docs);

writeFileSync(a2, seal({ version: 1, takenAt: takenAt.toISOString(), docs: merged }));
console.log(
  `${prev ? `Built on the backup of ${prev.takenAt}` : 'First (full) backup'}: ${Object.keys(merged).length} documents ` +
    `(${Object.keys(docs).length} read this week, ~${reads} reads${dropped ? `, ${dropped} from deleted students or classes dropped` : ''}).`,
);
