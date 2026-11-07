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

export interface ClassDoc {
  id: string;
  name: string;
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
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt?: Timestamp;
}
