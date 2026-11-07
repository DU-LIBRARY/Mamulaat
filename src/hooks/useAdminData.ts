import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { classesCol, logsRangeQuery, mamoolaatCol, usersCol } from '../lib/db';
import { sortMamoolaat } from './useStudentData';
import { useCollectionData } from './useFirestore';
import type { ClassDoc, DayLog, Mamool, UserProfile } from '../types';

export function useAllUsers() {
  const r = useCollectionData<UserProfile>(usersCol(), 'users');
  const users = useMemo(() => [...r.data].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)), [r.data]);
  return { ...r, data: users };
}

export function useClasses() {
  const r = useCollectionData<ClassDoc>(classesCol(), 'classes');
  const data = useMemo(() => [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })), [r.data]);
  return { ...r, data };
}

export interface StudentRange {
  mamoolaat: Mamool[];
  logs: Map<string, DayLog>;
  loaded: boolean;
}

/**
 * Live mamoolaat + logs within [from, to] for several students.
 * Admin views work best online; offline, this shows whatever is cached.
 */
export function useStudentsRange(uids: string[], from: string, to: string) {
  const key = `${uids.join(',')}|${from}|${to}`;
  const [state, setState] = useState<Map<string, StudentRange>>(new Map());
  useEffect(() => {
    const next = new Map<string, StudentRange>();
    uids.forEach((u) => next.set(u, { mamoolaat: [], logs: new Map(), loaded: false }));
    setState(new Map(next));
    const loaded = new Map<string, { m: boolean; l: boolean }>();
    const update = (uid: string, patch: Partial<StudentRange>, which: 'm' | 'l') => {
      const l = loaded.get(uid) ?? { m: false, l: false };
      l[which] = true;
      loaded.set(uid, l);
      setState((prev) => {
        const n = new Map(prev);
        const cur = n.get(uid) ?? { mamoolaat: [], logs: new Map(), loaded: false };
        n.set(uid, { ...cur, ...patch, loaded: l.m && l.l });
        return n;
      });
    };
    const unsubs = uids.flatMap((uid) => [
      onSnapshot(
        mamoolaatCol(uid),
        (s) => update(uid, { mamoolaat: sortMamoolaat(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Mamool)) }, 'm'),
        () => update(uid, {}, 'm'),
      ),
      onSnapshot(
        logsRangeQuery(uid, from, to),
        (s) => update(uid, { logs: new Map(s.docs.map((d) => [d.id, { id: d.id, ...d.data() } as DayLog])) }, 'l'),
        () => update(uid, {}, 'l'),
      ),
    ]);
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
