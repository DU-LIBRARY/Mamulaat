import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

export interface LiveResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
}

/** Live document subscription. Works offline from the persistent cache. `key` must change when the ref changes. */
export function useDocData<T>(ref: DocumentReference | null, key: string): LiveResult<T | null> {
  const [state, setState] = useState<LiveResult<T | null>>({ data: null, loading: !!ref, error: null, fromCache: false });
  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null, fromCache: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setState({ data: null, loading: false, error, fromCache: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Live query subscription. `key` must change when the query changes. */
export function useCollectionData<T>(q: Query | null, key: string): LiveResult<T[]> {
  const [state, setState] = useState<LiveResult<T[]>>({ data: [], loading: !!q, error: null, fromCache: false });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null, fromCache: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (error) => setState({ data: [], loading: false, error, fromCache: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
