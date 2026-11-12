import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { orderBy, query } from 'firebase/firestore';
import { changesCol, commentsCol, logsCol, mamoolaatCol, salahCol } from '../lib/db';
import { logsByDay } from '../lib/scoring';
import type { ChangeRecord, Comment, DayLog, Mamool, SalahDay } from '../types';
import { useCollectionData } from './useFirestore';

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
}

export function sortMamoolaat(list: Mamool[]) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

/** Live data for one student (used by the student themselves and by the admin). */
export function useStudentLive(uid: string, records = true): StudentData {
  // `records: false` (a limited admin): only the teacher's notes are loaded, never the student's
  // mamoolaat, logs, salah or the changes made to their list.
  const mam = useCollectionData<Mamool>(records ? mamoolaatCol(uid) : null, `mam:${uid}:${records}`);
  const logs = useCollectionData<DayLog>(records ? logsCol(uid) : null, `logs:${uid}:${records}`);
  const salah = useCollectionData<SalahDay>(records ? salahCol(uid) : null, `salah:${uid}:${records}`);
  const comments = useCollectionData<Comment>(query(commentsCol(uid), orderBy('createdAt', 'desc')), `com:${uid}`);
  const changes = useCollectionData<ChangeRecord>(records ? query(changesCol(uid), orderBy('createdAt', 'desc')) : null, `chg:${uid}:${records}`);
  return useMemo(() => {
    const all = sortMamoolaat(mam.data);
    return {
      loading: mam.loading || logs.loading,
      all,
      active: all.filter((m) => m.active),
      logs: logsByDay(logs.data),
      salah: new Map(salah.data.map((d) => [d.id, d])),
      comments: comments.data,
      changes: changes.data,
      unreadComments: comments.data.filter((c) => !c.readAt).length,
      unseenChanges: changes.data.filter((c) => !c.seenAt).length,
      pendingDays: [...new Set([...(logs.pendingIds ?? []), ...(salah.pendingIds ?? [])])],
    };
  }, [mam.data, mam.loading, logs.data, logs.loading, logs.pendingIds, salah.data, salah.pendingIds, comments.data, changes.data]);
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
