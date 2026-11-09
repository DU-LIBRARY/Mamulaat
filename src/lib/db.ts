import {
  collection,
  deleteField,
  doc,
  documentId,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppSettings, DayLog, LogEntry, Mamool, TemplateItem, UserProfile } from '../types';
import { DEFAULT_TIMEZONE, utcOffsetMinutes } from './dates';
import { fire, track } from './sync';
import { sameMamoolName } from './names';

export { sameMamoolName };

export const DEFAULT_SETTINGS: AppSettings = {
  backfillDays: 2,
  weekStart: 1,
  timezone: DEFAULT_TIMEZONE,
  utcOffsetMinutes: 0,
  attentionThreshold: 60,
  attentionNoLogDays: 3,
  defaultReminderTime: '20:00',
};

// ---------- refs ----------
export const userRef = (uid: string) => doc(db, 'users', uid);
export const usersCol = () => collection(db, 'users');
export const mamoolaatCol = (uid: string) => collection(db, 'users', uid, 'mamoolaat');
export const logsCol = (uid: string) => collection(db, 'users', uid, 'logs');
export const logRef = (uid: string, day: string) => doc(db, 'users', uid, 'logs', day);
export const commentsCol = (uid: string) => collection(db, 'users', uid, 'comments');
export const changesCol = (uid: string) => collection(db, 'users', uid, 'changes');
export const classesCol = () => collection(db, 'classes');
export const settingsRef = () => doc(db, 'settings', 'app');
export const auditCol = () => collection(db, 'auditLog');
export const nudgesCol = () => collection(db, 'nudges');
export const nudgeRef = (uid: string, day: string) => doc(db, 'nudges', `${uid}_${day}`);

export function logsRangeQuery(uid: string, from: string, to: string) {
  return query(logsCol(uid), where(documentId(), '>=', from), where(documentId(), '<=', to));
}

export interface Actor {
  uid: string;
  name: string;
}

function addAudit(batch: WriteBatch, actor: Actor, action: string, details: Record<string, unknown>) {
  batch.set(doc(auditCol()), {
    actorId: actor.uid,
    actorName: actor.name,
    action,
    details,
    createdAt: serverTimestamp(),
  });
}

// ---------- profile ----------
export function createPendingProfile(u: { uid: string; email: string; displayName: string | null; photoURL: string | null }) {
  return track(
    setDoc(userRef(u.uid), {
      name: u.displayName ?? null,
      email: u.email,
      photoURL: u.photoURL ?? null,
      role: 'student',
      status: 'pending',
      classId: null,
      requestedClassId: null,
      signupComplete: false,
      reminderEnabled: false,
      reminderTime: null,
      onboarded: false,
      createdAt: serverTimestamp(),
    }),
  );
}

/** New student: save the name they typed and the class they picked (still pending approval). */
export function completeSignup(uid: string, name: string, requestedClassId: string) {
  return track(
    updateDoc(userRef(uid), {
      name: name.trim().replace(/\s+/g, ' ').slice(0, 100),
      requestedClassId,
      signupComplete: true,
    }),
  );
}

export function updateOwnProfile(uid: string, data: Partial<Pick<UserProfile, 'name' | 'photoURL' | 'reminderEnabled' | 'reminderTime' | 'onboarded'>>) {
  fire(updateDoc(userRef(uid), data));
}

/** Record that the student opened the app (the admin sees "last seen"). Throttled by the caller. */
export function touchLastSeen(uid: string) {
  fire(updateDoc(userRef(uid), { lastSeenAt: serverTimestamp() }));
}

// ---------- logs ----------
/** Student writes clear any "edited by the teacher" stamp (the rules require it). */
const CLEAR_STAMP = { editedBy: deleteField(), editedByName: deleteField() };

/**
 * The stamp for a log write. Students clear it. The admin logging their OWN mamool
 * passes `self` (their Actor): the rules require every admin log write to carry the
 * admin's own `editedBy`, so it is stamped, but nothing is audited.
 */
function stamp(self?: Actor) {
  return self ? { editedBy: self.uid, editedByName: self.name.slice(0, 200) } : CLEAR_STAMP;
}

export function saveEntry(uid: string, day: string, mamoolId: string, entry: LogEntry | null, self?: Actor) {
  fire(
    setDoc(
      logRef(uid, day),
      {
        date: day,
        entries: { [mamoolId]: entry ?? deleteField() },
        updatedAt: serverTimestamp(),
        ...stamp(self),
      },
      { merge: true },
    ),
  );
}

export function saveEntries(uid: string, day: string, entries: Record<string, LogEntry>, self?: Actor) {
  fire(setDoc(logRef(uid, day), { date: day, entries, updatedAt: serverTimestamp(), ...stamp(self) }, { merge: true }));
}

/**
 * Put a day's entries back to exactly `prev` for the given mamoolaat (used by Undo):
 * entries that did not exist before are removed again.
 */
export function restoreEntries(uid: string, day: string, prev: Record<string, LogEntry | undefined>, self?: Actor) {
  const entries: Record<string, unknown> = {};
  for (const [id, e] of Object.entries(prev)) entries[id] = e ?? deleteField();
  fire(setDoc(logRef(uid, day), { date: day, entries, updatedAt: serverTimestamp(), ...stamp(self) }, { merge: true }));
}

/** Admin edits one entry of any student's log for ANY day. The log is stamped with who edited it, and audited. */
export function adminSaveEntry(uid: string, day: string, mamool: Pick<Mamool, 'id' | 'name'>, entry: LogEntry | null, actor: Actor) {
  const batch = writeBatch(db);
  batch.set(
    logRef(uid, day),
    {
      date: day,
      entries: { [mamool.id]: entry ?? deleteField() },
      updatedAt: serverTimestamp(),
      editedBy: actor.uid,
      editedByName: actor.name.slice(0, 200),
    },
    { merge: true },
  );
  addAudit(batch, actor, 'log.edit', { studentId: uid, day, mamoolId: mamool.id, mamoolName: mamool.name, entry });
  fire(batch.commit());
}

/** Admin deletes a student's whole log for one day. */
export function adminDeleteLog(uid: string, day: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.delete(logRef(uid, day));
  addAudit(batch, actor, 'log.delete', { studentId: uid, day });
  fire(batch.commit());
}

// ---------- mamoolaat ----------
type MamoolInput = Pick<Mamool, 'name' | 'target' | 'unit'>;

function cleanInput(m: MamoolInput): MamoolInput {
  return { name: m.name.trim().slice(0, 120), target: Math.max(0.01, Number(m.target) || 1), unit: m.unit.trim().slice(0, 40) };
}

/**
 * Add a mamool. When the actor isn't the student (i.e. the admin), the change
 * is also recorded in users/{uid}/changes (visible to the student) and the audit log.
 */
export function addMamool(uid: string, input: MamoolInput, order: number, today: string, actor: Actor) {
  const batch = writeBatch(db);
  const ref = doc(mamoolaatCol(uid));
  const m = cleanInput(input);
  batch.set(ref, {
    ...m,
    active: true,
    order,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    createdDate: today,
    removedDate: null,
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  if (actor.uid !== uid) recordChange(batch, uid, actor, 'added', ref.id, m.name, null, m);
  fire(batch.commit());
  return ref.id;
}

export function updateMamool(uid: string, before: Mamool, input: MamoolInput, actor: Actor) {
  const batch = writeBatch(db);
  const m = cleanInput(input);
  batch.update(doc(mamoolaatCol(uid), before.id), { ...m, updatedBy: actor.uid, updatedAt: serverTimestamp() });
  if (actor.uid !== uid) {
    recordChange(batch, uid, actor, 'updated', before.id, m.name,
      { name: before.name, target: before.target, unit: before.unit }, m);
  }
  fire(batch.commit());
}

/** Soft-remove so history and past percentages stay correct. */
export function removeMamool(uid: string, m: Mamool, today: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.update(doc(mamoolaatCol(uid), m.id), {
    active: false,
    removedDate: today,
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  if (actor.uid !== uid) {
    recordChange(batch, uid, actor, 'removed', m.id, m.name, { name: m.name, target: m.target, unit: m.unit }, null);
  }
  fire(batch.commit());
}

/** Permanently delete a mamool (the soft-remove above keeps history; this does not). */
export function deleteMamoolForever(uid: string, m: Mamool, actor: Actor) {
  const batch = writeBatch(db);
  batch.delete(doc(mamoolaatCol(uid), m.id));
  if (actor.uid !== uid) addAudit(batch, actor, 'mamool.delete', { studentId: uid, mamoolId: m.id, mamoolName: m.name });
  fire(batch.commit());
}

export function restoreMamool(uid: string, m: Mamool, today: string, actor: Actor) {
  const batch = writeBatch(db);
  // The days it spent removed must not count as missed, so remember them as a gap.
  const gaps = [...(m.gaps ?? [])];
  if (m.removedDate && m.removedDate < today) gaps.push({ from: m.removedDate, to: today });
  batch.update(doc(mamoolaatCol(uid), m.id), {
    active: true,
    removedDate: null,
    gaps: gaps.slice(-50),
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  if (actor.uid !== uid) recordChange(batch, uid, actor, 'added', m.id, m.name, null, { name: m.name, target: m.target, unit: m.unit });
  fire(batch.commit());
}

export function reorderMamoolaat(uid: string, ordered: Mamool[], actor: Actor) {
  const batch = writeBatch(db);
  ordered.forEach((m, i) => {
    if (m.order !== i) batch.update(doc(mamoolaatCol(uid), m.id), { order: i, updatedBy: actor.uid, updatedAt: serverTimestamp() });
  });
  fire(batch.commit());
}

function recordChange(
  batch: WriteBatch,
  uid: string,
  actor: Actor,
  kind: 'added' | 'removed' | 'updated',
  mamoolId: string,
  mamoolName: string,
  before: MamoolInput | null,
  after: MamoolInput | null,
) {
  batch.set(doc(changesCol(uid)), {
    kind,
    mamoolId,
    mamoolName,
    before,
    after,
    actorId: actor.uid,
    actorName: actor.name,
    createdAt: serverTimestamp(),
    seenAt: null,
  });
  addAudit(batch, actor, `mamool.${kind}`, { studentId: uid, mamoolId, mamoolName, before, after });
}

// ---------- comments & changes (student side) ----------
export function markCommentRead(uid: string, commentId: string) {
  fire(updateDoc(doc(commentsCol(uid), commentId), { readAt: serverTimestamp() }));
}

export function markChangeSeen(uid: string, changeId: string) {
  fire(updateDoc(doc(changesCol(uid), changeId), { seenAt: serverTimestamp() }));
}

// ---------- comments (admin side) ----------
export function addComment(uid: string, text: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.set(doc(commentsCol(uid)), {
    text: text.trim().slice(0, 4000),
    authorId: actor.uid,
    authorName: actor.name,
    createdAt: serverTimestamp(),
    readAt: null,
  });
  addAudit(batch, actor, 'comment.add', { studentId: uid });
  fire(batch.commit());
}

export function deleteComment(uid: string, commentId: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.delete(doc(commentsCol(uid), commentId));
  addAudit(batch, actor, 'comment.delete', { studentId: uid, commentId });
  fire(batch.commit());
}

export function deleteChange(uid: string, changeId: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.delete(doc(changesCol(uid), changeId));
  addAudit(batch, actor, 'change.delete', { studentId: uid, changeId });
  fire(batch.commit());
}

// ---------- nudges ----------
/**
 * Ask the reminder function to push "please log today" to these students now.
 * One nudge per student per day (the doc id makes a second one fail, so nobody is spammed).
 */
export async function sendNudges(uids: string[], day: string, actor: Actor) {
  for (let i = 0; i < uids.length; i += 200) {
    const batch = writeBatch(db);
    uids.slice(i, i + 200).forEach((uid) =>
      batch.set(nudgeRef(uid, day), { uid, day, actorId: actor.uid, actorName: actor.name.slice(0, 200), createdAt: serverTimestamp() }),
    );
    addAudit(batch, actor, 'nudge.send', { day, count: Math.min(200, uids.length - i), studentIds: uids.slice(i, i + 200) });
    await track(batch.commit());
  }
}

// ---------- classes ----------
export function createClass(name: string, actor: Actor) {
  const batch = writeBatch(db);
  const ref = doc(classesCol());
  batch.set(ref, { name: name.trim().slice(0, 100) });
  addAudit(batch, actor, 'class.create', { classId: ref.id, name });
  fire(batch.commit());
  return ref.id;
}

export function renameClass(classId: string, name: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.update(doc(classesCol(), classId), { name: name.trim().slice(0, 100) });
  addAudit(batch, actor, 'class.rename', { classId, name });
  fire(batch.commit());
}

/**
 * Delete a class. Everyone still in it is first moved to `moveTo` (or left without a class
 * when null), and pending sign-ups that asked for it are sent back to pick another class.
 * The class itself is deleted last, so a failure part-way never loses students.
 */
export async function deleteClass(classId: string, actor: Actor, members: UserProfile[] = [], moveTo: string | null = null) {
  const affected = members.filter((u) => u.classId === classId || u.requestedClassId === classId);
  const ops = affected.map((u) => {
    const patch: Record<string, unknown> = {};
    if (u.classId === classId) patch.classId = moveTo;
    if (u.requestedClassId === classId) {
      patch.requestedClassId = null;
      if (u.status === 'pending') patch.signupComplete = false;
    }
    return { u, patch };
  });
  for (let i = 0; i < ops.length; i += 200) {
    const batch = writeBatch(db);
    ops.slice(i, i + 200).forEach(({ u, patch }) => {
      batch.update(userRef(u.id), patch);
      addAudit(batch, actor, 'user.move', { userId: u.id, classId: moveTo, reason: 'class deleted' });
    });
    await track(batch.commit());
  }
  const batch = writeBatch(db);
  batch.delete(doc(classesCol(), classId));
  addAudit(batch, actor, 'class.delete', { classId, movedTo: moveTo, studentsMoved: ops.length });
  await track(batch.commit());
}

// ---------- class templates ----------
export function saveClassTemplate(classId: string, template: TemplateItem[], actor: Actor) {
  const batch = writeBatch(db);
  const clean = template.slice(0, 50).map((t) => cleanInput(t));
  batch.update(doc(classesCol(), classId), { template: clean });
  addAudit(batch, actor, 'class.template', { classId, template: clean });
  return track(batch.commit());
}

/**
 * Add the class template to each student's OWN list. Nothing is replaced or removed:
 * items the student already has (same name) are skipped, the rest go at the end of their list,
 * and each addition is recorded so the student sees it and can tidy up any overlaps.
 */
export async function applyTemplate(uids: string[], template: TemplateItem[], today: string, actor: Actor) {
  let added = 0;
  let skipped = 0;
  for (const uid of uids) {
    const snap = await getDocs(mamoolaatCol(uid));
    const existing = snap.docs.map((d) => d.data() as Mamool);
    let order = existing.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);
    const toAdd = template.filter((t) => {
      const dup = existing.some((m) => m.active && sameMamoolName(m.name, t.name));
      if (dup) skipped++;
      return !dup;
    });
    if (!toAdd.length) continue;
    const batch = writeBatch(db);
    for (const t of toAdd) {
      const ref = doc(mamoolaatCol(uid));
      const m = cleanInput(t);
      batch.set(ref, {
        ...m,
        active: true,
        order: order++,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        createdDate: today,
        removedDate: null,
        updatedBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
      recordChange(batch, uid, actor, 'added', ref.id, m.name, null, m);
      added++;
    }
    await track(batch.commit());
  }
  return { added, skipped };
}

// ---------- one-off reads for exports ----------
/** Mamoolaat + logs in [from, to] for several students, read once (for CSV exports). */
export async function fetchStudentsRange(uids: string[], from: string, to: string) {
  const out = new Map<string, { mamoolaat: Mamool[]; logs: Map<string, DayLog> }>();
  await Promise.all(
    uids.map(async (uid) => {
      const [m, l] = await Promise.all([getDocs(mamoolaatCol(uid)), getDocs(logsRangeQuery(uid, from, to))]);
      out.set(uid, {
        mamoolaat: m.docs.map((d) => ({ id: d.id, ...d.data() }) as Mamool),
        logs: new Map(l.docs.map((d) => [d.id, { id: d.id, ...d.data() } as DayLog])),
      });
    }),
  );
  return out;
}

// ---------- user management (admin) ----------
function adminUserUpdate(uid: string, data: Record<string, unknown>, actor: Actor, action: string, details: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.update(userRef(uid), data);
  addAudit(batch, actor, action, { userId: uid, ...details });
  return track(batch.commit());
}

export const approveUser = (uid: string, classId: string, actor: Actor) =>
  adminUserUpdate(uid, { status: 'active', classId }, actor, 'user.approve', { classId });
export const rejectUser = (uid: string, actor: Actor) => adminUserUpdate(uid, { status: 'rejected', classId: null }, actor, 'user.reject');
export const deactivateUser = (uid: string, actor: Actor) => adminUserUpdate(uid, { status: 'inactive' }, actor, 'user.deactivate');
export const reactivateUser = (uid: string, actor: Actor) => adminUserUpdate(uid, { status: 'active' }, actor, 'user.reactivate');
export const moveUser = (uid: string, classId: string, actor: Actor) => adminUserUpdate(uid, { classId }, actor, 'user.move', { classId });
export const renameUser = (uid: string, name: string, actor: Actor) =>
  adminUserUpdate(uid, { name: name.trim().replace(/\s+/g, ' ').slice(0, 100) }, actor, 'user.rename', { name });
/** Put someone back to waiting-for-approval (they keep their data; classId is cleared). */
export const setPending = (uid: string, actor: Actor) => adminUserUpdate(uid, { status: 'pending', classId: null }, actor, 'user.pending');

export type BulkAction =
  | { kind: 'approve'; classId: string }
  | { kind: 'move'; classId: string }
  | { kind: 'deactivate' }
  | { kind: 'reactivate' };

/** Apply one action to several users, chunked into batches (each user = 1 update + 1 audit entry). */
export async function bulkUpdateUsers(uids: string[], action: BulkAction, actor: Actor) {
  const patch: Record<string, unknown> =
    action.kind === 'approve' ? { status: 'active', classId: action.classId }
    : action.kind === 'move' ? { classId: action.classId }
    : action.kind === 'deactivate' ? { status: 'inactive' }
    : { status: 'active' };
  for (let i = 0; i < uids.length; i += 200) {
    const batch = writeBatch(db);
    uids.slice(i, i + 200).forEach((uid) => {
      batch.update(userRef(uid), patch);
      addAudit(batch, actor, `user.${action.kind}`, { userId: uid, bulk: true, ...('classId' in action ? { classId: action.classId } : {}) });
    });
    await track(batch.commit());
  }
}

/** Delete a student and ALL their data (mamoolaat, logs, comments, changes, tokens). Must be online. */
export async function deleteStudent(uid: string, actor: Actor, name: string) {
  const subs = ['mamoolaat', 'logs', 'comments', 'changes', 'fcmTokens', 'pushSubs'];
  const failed: string[] = [];
  // Delete every sub-collection; keep going if one fails so we never leave a half-deleted student,
  // and only remove the profile once everything else is gone (so a retry can finish the job).
  for (const sub of subs) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await track(batch.commit());
      }
    } catch (e) {
      failed.push(`${sub}: ${(e as Error).message}`);
    }
  }
  try {
    const nudges = await getDocs(query(nudgesCol(), where('uid', '==', uid)));
    for (let i = 0; i < nudges.docs.length; i += 400) {
      const batch = writeBatch(db);
      nudges.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await track(batch.commit());
    }
  } catch (e) {
    failed.push(`nudges: ${(e as Error).message}`);
  }
  if (failed.length) throw new Error(`Could not delete everything (${failed.join('; ')}). The student was NOT removed; try again.`);
  const batch = writeBatch(db);
  batch.delete(userRef(uid));
  addAudit(batch, actor, 'user.delete', { userId: uid, name });
  await track(batch.commit());
}

/**
 * Hand the admin role to another approved user. Done in ONE batch so the
 * security rules can verify there is exactly one admin afterwards.
 * The old admin becomes an inactive student and loses all access.
 */
export async function transferAdmin(me: Actor, target: UserProfile) {
  const batch = writeBatch(db);
  batch.update(userRef(target.id), { role: 'admin', status: 'active', classId: null });
  batch.update(userRef(me.uid), { role: 'student', status: 'inactive', classId: null, handedOverTo: target.id });
  addAudit(batch, me, 'admin.transfer', { from: me.uid, to: target.id, toName: target.name });
  await track(batch.commit());
}

// ---------- settings ----------
export function normalizeSettings(s: Partial<AppSettings> | null | undefined): AppSettings {
  const v = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  return {
    backfillDays: Math.max(0, Math.min(30, Math.round(Number(v.backfillDays)))),
    weekStart: Math.max(0, Math.min(6, Math.round(Number(v.weekStart)))),
    timezone: String(v.timezone || DEFAULT_TIMEZONE),
    utcOffsetMinutes: Math.round(Number(v.utcOffsetMinutes) || 0),
    attentionThreshold: Math.max(0, Math.min(100, Number(v.attentionThreshold))),
    attentionNoLogDays: Math.max(1, Math.min(60, Math.round(Number(v.attentionNoLogDays)))),
    defaultReminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(v.defaultReminderTime) ? v.defaultReminderTime : '20:00',
  };
}

export function saveSettings(s: AppSettings, actor: Actor) {
  const batch = writeBatch(db);
  const n = normalizeSettings(s);
  const data: AppSettings = { ...n, utcOffsetMinutes: utcOffsetMinutes(n.timezone) };
  batch.set(settingsRef(), data);
  addAudit(batch, actor, 'settings.update', { ...data });
  return track(batch.commit());
}

/** Keep the rules' UTC offset in step with the timezone (e.g. DST changes). */
export function refreshOffsetIfNeeded(s: AppSettings | null) {
  if (!s) return;
  const n = normalizeSettings(s);
  const off = utcOffsetMinutes(n.timezone);
  if (off !== s.utcOffsetMinutes) fire(setDoc(settingsRef(), { ...n, utcOffsetMinutes: off }));
}

export function auditQuery() {
  return query(auditCol(), orderBy('createdAt', 'desc'));
}
