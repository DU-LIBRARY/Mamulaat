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
import type { AppSettings, LogEntry, Mamool, UserProfile } from '../types';
import { DEFAULT_TIMEZONE, utcOffsetMinutes } from './dates';
import { fire, track } from './sync';

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
export const tokensCol = (uid: string) => collection(db, 'users', uid, 'fcmTokens');
export const classesCol = () => collection(db, 'classes');
export const settingsRef = () => doc(db, 'settings', 'app');
export const auditCol = () => collection(db, 'auditLog');

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

// ---------- logs ----------
export function saveEntry(uid: string, day: string, mamoolId: string, entry: LogEntry | null) {
  fire(
    setDoc(
      logRef(uid, day),
      {
        date: day,
        entries: { [mamoolId]: entry ?? deleteField() },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
}

export function saveEntries(uid: string, day: string, entries: Record<string, LogEntry>) {
  fire(setDoc(logRef(uid, day), { date: day, entries, updatedAt: serverTimestamp() }, { merge: true }));
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

export function restoreMamool(uid: string, m: Mamool, actor: Actor) {
  const batch = writeBatch(db);
  batch.update(doc(mamoolaatCol(uid), m.id), {
    active: true,
    removedDate: null,
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

export function deleteClass(classId: string, actor: Actor) {
  const batch = writeBatch(db);
  batch.delete(doc(classesCol(), classId));
  addAudit(batch, actor, 'class.delete', { classId });
  fire(batch.commit());
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

/** Delete a student and ALL their data (mamoolaat, logs, comments, changes, tokens). Must be online. */
export async function deleteStudent(uid: string, actor: Actor, email: string) {
  const subs = ['mamoolaat', 'logs', 'comments', 'changes', 'fcmTokens'];
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
  if (failed.length) throw new Error(`Could not delete everything (${failed.join('; ')}). The student was NOT removed; try again.`);
  const batch = writeBatch(db);
  batch.delete(userRef(uid));
  addAudit(batch, actor, 'user.delete', { userId: uid, email });
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
  addAudit(batch, me, 'admin.transfer', { from: me.uid, to: target.id, toEmail: target.email });
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
