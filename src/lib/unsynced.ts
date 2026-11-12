import { useSyncExternalStore } from 'react';
import { doc, getDocFromServer, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Keeps track of a student's own entries that have not reached the server yet, so the app can
 * say so when they never arrive.
 *
 * Entries are saved on the phone first and sent when there is a connection. The server only
 * accepts a day's entries until that day closes (today plus the backfill window), so entries
 * written offline and sent too late are refused, and the phone's copy then quietly reverts.
 * This ledger (kept in localStorage, per account) remembers what was written for which day:
 *  - while offline, the app can warn which day has to sync and by when;
 *  - when a write is refused, or is found missing after a restart, the day is listed as
 *    "not saved" until the student has seen it.
 */
export type Kind = 'logs' | 'salah';
export interface Waiting {
  kind: Kind;
  day: string;
  /** What the student set for each id (mamool id or salah name); null = cleared. */
  ids: Record<string, unknown>;
}
export interface Lost {
  kind: Kind;
  day: string;
}
interface State {
  waiting: Waiting[];
  lost: Lost[];
}

const EMPTY: State = { waiting: [], lost: [] };
const key = (uid: string) => `mamulaat.unsynced.${uid}`;
const listeners = new Set<() => void>();
const cache = new Map<string, State>();
/** Writes sent in THIS session and not yet answered, per kind/day. */
const inFlight = new Map<string, number>();

function read(uid: string): State {
  const hit = cache.get(uid);
  if (hit) return hit;
  let s = EMPTY;
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) ?? 'null');
    if (raw && Array.isArray(raw.waiting) && Array.isArray(raw.lost)) s = { waiting: raw.waiting, lost: raw.lost };
  } catch {
    // unreadable: start clean
  }
  cache.set(uid, s);
  return s;
}

function write(uid: string, s: State) {
  cache.set(uid, s);
  try {
    if (s.waiting.length || s.lost.length) localStorage.setItem(key(uid), JSON.stringify(s));
    else localStorage.removeItem(key(uid));
  } catch {
    // storage full or blocked: the in-memory copy still works for this session
  }
  listeners.forEach((l) => l());
}

const same = (a: Lost, b: Lost) => a.kind === b.kind && a.day === b.day;
const flightKey = (uid: string, kind: Kind, day: string) => `${uid}|${kind}|${day}`;

/** `outcome`: the server took it, refused it, or the write failed some other way (kept, and checked later). */
function settle(uid: string, kind: Kind, day: string, outcome: 'saved' | 'refused' | 'unknown') {
  const k = flightKey(uid, kind, day);
  const left = Math.max(0, (inFlight.get(k) ?? 1) - 1);
  inFlight.set(k, left);
  const s = read(uid);
  if (outcome === 'refused') {
    write(uid, { waiting: s.waiting.filter((w) => !same(w, { kind, day })), lost: s.lost.some((l) => same(l, { kind, day })) ? s.lost : [...s.lost, { kind, day }] });
  } else if (outcome === 'saved' && left === 0) {
    write(uid, { ...s, waiting: s.waiting.filter((w) => !same(w, { kind, day })) });
  }
}

/** Remember a student's write until the server answers. `ids`: what was set (null = cleared). */
export function noteWrite(uid: string, kind: Kind, day: string, ids: Record<string, unknown>, p: Promise<unknown>) {
  const s = read(uid);
  const cur = s.waiting.find((w) => same(w, { kind, day }));
  const merged: Waiting = { kind, day, ids: { ...(cur?.ids ?? {}), ...ids } };
  write(uid, { ...s, waiting: [...s.waiting.filter((w) => !same(w, { kind, day })), merged] });
  const k = flightKey(uid, kind, day);
  inFlight.set(k, (inFlight.get(k) ?? 0) + 1);
  p.then(
    () => settle(uid, kind, day, 'saved'),
    (e: unknown) => settle(uid, kind, day, (e as { code?: string })?.code === 'permission-denied' ? 'refused' : 'unknown'),
  );
}

const norm = (v: unknown): string => {
  if (v == null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  const o = v as Record<string, unknown>;
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
};

/**
 * After a restart: writes left in the ledger by an earlier session have either been sent by
 * now or been refused. Ask the server what it holds and list anything missing as not saved.
 * Does nothing while offline (it is tried again when the connection returns).
 */
export async function checkLeftovers(uid: string) {
  const left = read(uid).waiting.filter((w) => !(inFlight.get(flightKey(uid, w.kind, w.day)) ?? 0));
  if (!left.length || !navigator.onLine) return;
  try {
    await waitForPendingWrites(db);
    for (const w of left) {
      const snap = await getDocFromServer(doc(db, 'users', uid, w.kind, w.day));
      const data = snap.data() as { entries?: Record<string, unknown>; editedBy?: string } | undefined;
      // A day the teacher has edited since is the teacher's version, not a lost one.
      const kept = !!data?.editedBy || Object.entries(w.ids).every(([id, v]) => norm(data?.entries?.[id]) === norm(v));
      if ((inFlight.get(flightKey(uid, w.kind, w.day)) ?? 0) > 0) continue; // written again meanwhile
      settle(uid, w.kind, w.day, kept ? 'saved' : 'refused');
    }
  } catch {
    // no connection after all: keep the ledger and try again later
  }
}

export function dismissLost(uid: string) {
  write(uid, { ...read(uid), lost: [] });
}

/** Forget everything for this account on this device (sign-out wipes the offline copy too). */
export function clearUnsynced(uid: string) {
  cache.delete(uid);
  try {
    localStorage.removeItem(key(uid));
  } catch {
    // nothing to do
  }
  listeners.forEach((l) => l());
}

export function useUnsynced(uid: string): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(uid),
  );
}
