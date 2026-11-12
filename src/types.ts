import type { Timestamp } from 'firebase/firestore';

/** Roles are a string union so another role (e.g. 'teacher') can be added later. */
export type Role = 'student' | 'admin';
export type UserStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photoURL: string | null;
  role: Role;
  status: UserStatus;
  classId: string | null;
  /** Class the student asked to join at sign-up (the admin decides the real classId). */
  requestedClassId?: string | null;
  /** True once the student has entered their name and chosen a class. */
  signupComplete?: boolean;
  reminderEnabled: boolean;
  reminderTime: string | null; // "HH:MM" in the project timezone
  onboarded: boolean;
  createdAt?: Timestamp;
  lastSeenAt?: Timestamp;
  handedOverTo?: string;
}

/** One mamool in a class template (added to each student's own list; never replaces it). */
export interface TemplateItem {
  name: string;
  target: number;
  unit: string;
}

export interface ClassDoc {
  id: string;
  name: string;
  /** Mamoolaat the admin wants everyone in this class to have. */
  template?: TemplateItem[];
  /** A student of this class who may see the class's daily Fajr roll (set by the admin). */
  fajrMonitorId?: string | null;
  fajrMonitorName?: string | null;
}

/** A one-off "please log today" push from the admin. Doc id = `${uid}_${day}` (one per student per day). */
export interface Nudge {
  id: string;
  uid: string;
  day: string;
  actorId: string;
  actorName: string;
  createdAt?: Timestamp;
}

export interface Mamool {
  id: string;
  name: string;
  target: number;
  unit: string;
  active: boolean;
  order: number;
  createdBy: string;
  createdAt?: Timestamp;
  createdDate: string; // YYYY-MM-DD — first day this mamool counts
  removedDate: string | null; // YYYY-MM-DD — first day it no longer counts
  /** Periods while it was removed then restored: days in [from, to) do not count. */
  gaps?: { from: string; to: string }[];
  updatedBy: string;
  updatedAt?: Timestamp;
}

export type EntryStatus = 'done' | 'partial' | 'missed';

export interface LogEntry {
  status: EntryStatus;
  amount: number;
  /** Target at the time of logging, so later target changes don't rewrite history. */
  target: number;
}

export interface DayLog {
  id: string; // YYYY-MM-DD
  date: string;
  entries: Record<string, LogEntry>;
  updatedAt?: Timestamp;
  /** Set when the admin (not the student) last edited this day. */
  editedBy?: string;
  editedByName?: string;
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt?: Timestamp;
  readAt: Timestamp | null;
}

export interface ChangeRecord {
  id: string;
  kind: 'added' | 'removed' | 'updated';
  mamoolId: string;
  mamoolName: string;
  before: Partial<Pick<Mamool, 'name' | 'target' | 'unit'>> | null;
  after: Partial<Pick<Mamool, 'name' | 'target' | 'unit'>> | null;
  actorId: string;
  actorName: string;
  createdAt?: Timestamp;
  seenAt: Timestamp | null;
}

export interface AppSettings {
  backfillDays: number;
  weekStart: number; // 0 = Sunday ... 1 = Monday (default)
  timezone: string; // IANA, e.g. "Europe/London"
  utcOffsetMinutes: number; // derived from timezone, used by security rules
  attentionThreshold: number; // percent, e.g. 60
  attentionNoLogDays: number; // flag students with no logs for this many days
  defaultReminderTime: string; // "HH:MM"
  /** When the Fajr monitor gets the day's Fajr summary push ("HH:MM", project timezone). */
  fajrReportTime: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt?: Timestamp;
}

// ---------- salah ----------
export const SALAH_NAMES = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const;
export type SalahName = (typeof SALAH_NAMES)[number];
/** takbir = in jamaat from the opening takbir; jamaat = in jamaat, joined late; qadha = made up later. */
export type SalahStatus = 'takbir' | 'jamaat' | 'qadha' | 'missed';

/** users/{uid}/salah/{YYYY-MM-DD}: one doc per day, kept apart from mamool logs and their scores. */
export interface SalahDay {
  id: string;
  date: string;
  entries: Partial<Record<SalahName, SalahStatus>>;
  updatedAt?: Timestamp;
  editedBy?: string;
  editedByName?: string;
}

/**
 * classes/{classId}/fajrRoll/{YYYY-MM-DD}: each student's Fajr as missed/prayed only, readable by the
 * admin and the class's Fajr monitor. Each student writes only their own key.
 */
export interface FajrRoll {
  id: string;
  r?: Record<string, { name: string; status: RollStatus }>;
}

/**
 * What the Fajr register stores per student: only whether they missed (missed or qadha) or
 * prayed (with or without the opening takbir). The monitor never receives anything finer.
 */
export type RollStatus = 'missed' | 'prayed';

/** classes/{classId}/meta/roster: names of the class's active students, for "not logged yet". */
export interface ClassRoster {
  names: Record<string, string>;
}
