import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { orderBy, query } from 'firebase/firestore';
import { changesCol, commentsCol, logsCol, mamoolaatCol } from '../lib/db';
import { logsByDay } from '../lib/scoring';
import type { ChangeRecord, Comment, DayLog, Mamool } from '../types';
import { useCollectionData } from './useFirestore';

export interface StudentData {
  loading: boolean;
  all: Mamool[]; // including removed
  active: Mamool[];
  logs: Map<string, DayLog>;
  comments: Comment[];
  changes: ChangeRecord[];
  unreadComments: number;
  unseenChanges: number;
}

export function sortMamoolaat(list: Mamool[]) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

/** Live data for one student (used by the student themselves and by the admin). */
export function useStudentLive(uid: string): StudentData {
  const mam = useCollectionData<Mamool>(mamoolaatCol(uid), `mam:${uid}`);
  const logs = useCollectionData<DayLog>(logsCol(uid), `logs:${uid}`);
  const comments = useCollectionData<Comment>(query(commentsCol(uid), orderBy('createdAt', 'desc')), `com:${uid}`);
  const changes = useCollectionData<ChangeRecord>(query(changesCol(uid), orderBy('createdAt', 'desc')), `chg:${uid}`);
  return useMemo(() => {
    const all = sortMamoolaat(mam.data);
    return {
      loading: mam.loading || logs.loading,
      all,
      active: all.filter((m) => m.active),
      logs: logsByDay(logs.data),
      comments: comments.data,
      changes: changes.data,
      unreadComments: comments.data.filter((c) => !c.readAt).length,
      unseenChanges: changes.data.filter((c) => !c.seenAt).length,
    };
  }, [mam.data, mam.loading, logs.data, logs.loading, comments.data, changes.data]);
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
