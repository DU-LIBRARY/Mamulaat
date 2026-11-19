import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { documentId, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { changesCol, commentsCol, logsCol, mamoolaatCol, salahCol } from '../lib/db';
import { logsByDay } from '../lib/scoring';
import { addDays } from '../lib/dates';
import type { ChangeRecord, Comment, DayLog, Mamool, SalahDay } from '../types';
import { useCollectionData } from './useFirestore';
import { useSession } from './useSession';

/**
 * How many days back are kept live all the time. Everything a student does day to day (today,
 * the days they can still fill in, this week and the last few) is inside it.
 *
 * Older days are loaded only when a screen asks for them (needFrom), a month at a time. Loading
 * every log ever on each open would cost hundreds of reads per open by the end of the year,
 * enough to hit the free plan's daily read limit.
 */
export const LIVE_DAYS = 42;

export interface StudentData {
  loading: boolean;
  all: Mamool[]; // including removed
  active: Mamool[];
  logs: Map<string, DayLog>;
  /** Salah record per day (kept apart from the mamool scores). */
  salah: Map<string, SalahDay>;
  comments: Comment[];
  changes: ChangeRecord[];
  unreadComments: number;
  unseenChanges: number;
  /** Days whose log or salah is saved on this device but not yet on the server. */
  pendingDays: string[];
  /** The earliest day loaded (or being loaded). `logs` and `salah` hold nothing before it. */
  from: string;
  /** Ask for every day from `day` onward to be loaded (older months load on demand). */
  needFrom: (day: string) => void;
  /** True while older months asked for with needFrom are still loading. */
  olderLoading: boolean;
}

/** First day of each month from `from`'s month up to (not including) `until`. */
function monthStarts(from: string, until: string): string[] {
  const out: string[] = [];
  for (let m = `${from.slice(0, 7)}-01`; m < until; m = nextMonth(m)) out.push(m);
  return out;
}

/** The first day of the month after `day`'s. */
function nextMonth(day: string): string {
  const y = Number(day.slice(0, 4));
  const mo = Number(day.slice(5, 7));
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
}

interface Chunk {
  logs: DayLog[];
  salah: SalahDay[];
  pending: string[];
  loaded: { l: boolean; s: boolean };
}

/**
 * Live listeners for the months before the live window, one pair (logs, salah) per month, so asking
 * for an older week adds only that month's listeners instead of re-reading everything.
 * Listeners (not one-off reads) so an admin's edit to an old day shows up straight away.
 */
function useOlderMonths(uid: string | null, earliest: string | null, liveFrom: string) {
  const [chunks, setChunks] = useState<Record<string, Chunk>>({});
  const subs = useRef(new Map<string, () => void>());
  const wanted = uid && earliest && earliest < liveFrom ? monthStarts(earliest, liveFrom).map((m) => `${uid}|${m}|${liveFrom}`) : [];
  const wantedKey = wanted.join(',');

  useEffect(() => {
    const keep = new Set(wanted);
    for (const [k, unsub] of subs.current) {
      if (!keep.has(k)) {
        unsub();
        subs.current.delete(k);
      }
    }
    setChunks((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => keep.has(k))));
    for (const k of wanted) {
      if (subs.current.has(k)) continue;
      const [u, start, until] = k.split('|');
      const next = nextMonth(start);
      const end = next < until ? next : until;
      const range = (col: ReturnType<typeof logsCol>) => query(col, where(documentId(), '>=', start), where(documentId(), '<', end));
      const set = (patch: Partial<Chunk>, which: 'l' | 's') =>
        setChunks((prev) => {
          const cur = prev[k] ?? { logs: [], salah: [], pending: [], loaded: { l: false, s: false } };
          return { ...prev, [k]: { ...cur, ...patch, loaded: { ...cur.loaded, [which]: true } } };
        });
      const u1 = onSnapshot(
        range(logsCol(u)),
        { includeMetadataChanges: true },
        (snap) =>
          set({ logs: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DayLog), pending: snap.docs.filter((d) => d.metadata.hasPendingWrites).map((d) => d.id) }, 'l'),
        () => set({}, 'l'),
      );
      const u2 = onSnapshot(
        range(salahCol(u)),
        (snap) => set({ salah: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SalahDay) }, 's'),
        () => set({}, 's'),
      );
      subs.current.set(k, () => {
        u1();
        u2();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);

  // Stop everything when the screen goes away.
  useEffect(
    () => () => {
      for (const unsub of subs.current.values()) unsub();
      subs.current.clear();
    },
    [],
  );

  return useMemo(() => {
    const list = wanted.map((k) => chunks[k]).filter((c): c is Chunk => !!c);
    return {
      logs: list.flatMap((c) => c.logs),
      salah: list.flatMap((c) => c.salah),
      pending: list.flatMap((c) => c.pending),
      loading: wanted.some((k) => !chunks[k]?.loaded.l || !chunks[k]?.loaded.s),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, wantedKey]);
}

export function sortMamoolaat(list: Mamool[]) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

/** Live data for one student (used by the student themselves and by the admin). */
export function useStudentLive(uid: string, records = true): StudentData {
  // `records: false` (a limited admin): only the teacher's notes are loaded, never the student's
  // mamoolaat, logs, salah or the changes made to their list.
  const { today } = useSession();
  const liveFrom = addDays(today, -LIVE_DAYS);
  const mam = useCollectionData<Mamool>(records ? mamoolaatCol(uid) : null, `mam:${uid}:${records}`);
  const logs = useCollectionData<DayLog>(records ? query(logsCol(uid), where(documentId(), '>=', liveFrom)) : null, `logs:${uid}:${records}:${liveFrom}`);
  const salah = useCollectionData<SalahDay>(records ? query(salahCol(uid), where(documentId(), '>=', liveFrom)) : null, `salah:${uid}:${records}:${liveFrom}`);
  // The earliest day any screen has asked for, per student (a new student starts again).
  const [asked, setAsked] = useState<{ uid: string; day: string } | null>(null);
  const earliest = asked?.uid === uid ? asked.day : null;
  const needFrom = useCallback(
    (day: string) => setAsked((a) => (a?.uid === uid && a.day <= day ? a : { uid, day: a?.uid === uid && a.day < day ? a.day : day })),
    [uid],
  );
  const older = useOlderMonths(records ? uid : null, earliest, liveFrom);
  const comments = useCollectionData<Comment>(query(commentsCol(uid), orderBy('createdAt', 'desc')), `com:${uid}`);
  const changes = useCollectionData<ChangeRecord>(records ? query(changesCol(uid), orderBy('createdAt', 'desc')) : null, `chg:${uid}:${records}`);
  return useMemo(() => {
    const all = sortMamoolaat(mam.data);
    return {
      loading: mam.loading || logs.loading,
      all,
      active: all.filter((m) => m.active),
      // older months first, so the live window wins for any day in both
      logs: logsByDay([...older.logs, ...logs.data]),
      salah: new Map([...older.salah, ...salah.data].map((d) => [d.id, d])),
      comments: comments.data,
      changes: changes.data,
      unreadComments: comments.data.filter((c) => !c.readAt).length,
      unseenChanges: changes.data.filter((c) => !c.seenAt).length,
      pendingDays: [...new Set([...(logs.pendingIds ?? []), ...(salah.pendingIds ?? []), ...older.pending])],
      from: earliest && earliest < liveFrom ? earliest : liveFrom,
      needFrom,
      olderLoading: older.loading,
    };
  }, [mam.data, mam.loading, logs.data, logs.loading, logs.pendingIds, salah.data, salah.pendingIds, comments.data, changes.data, older, earliest, liveFrom, needFrom]);
}

const Ctx = createContext<StudentData | null>(null);

export function StudentDataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const data = useStudentLive(uid);
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useMyData() {
  const d = useContext(Ctx);
  if (!d) throw new Error('useMyData outside StudentDataProvider');
  return d;
}

/** Make sure every day from `day` onward is loaded (no-op inside the live window). */
export function useLoadFrom(data: StudentData, day: string | null | undefined) {
  const { needFrom } = data;
  useEffect(() => {
    if (day) needFrom(day);
  }, [day, needFrom]);
}

/**
 * A current streak can run back past what is loaded: while it reaches the edge, load two more
 * months (at most ten years back, like the streak walk itself).
 */
export function useStreakHistory(data: StudentData, today: string, streak: number) {
  const { from, needFrom, olderLoading } = data;
  useEffect(() => {
    if (olderLoading || streak <= 0 || streak > 3660) return;
    if (addDays(today, -streak - 1) < from) needFrom(addDays(from, -62));
  }, [from, needFrom, olderLoading, streak, today]);
}
