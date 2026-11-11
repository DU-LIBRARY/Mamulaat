import { useSyncExternalStore } from 'react';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Tracks writes that haven't been acknowledged by the server yet, plus
 * online/offline state, for the "offline / syncing / synced" indicator.
 *
 * Firestore write promises resolve only when the server confirms the write,
 * so while offline they stay pending (the data is already in the local cache).
 */
let pending = 0;
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let snapshot: { pending: number; online: boolean; lastError: string | null } = { pending, online, lastError };

function emit() {
  snapshot = { pending, online, lastError };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    emit();
  });
  window.addEventListener('offline', () => {
    online = false;
    emit();
  });
  // Writes queued in a previous session (e.g. the app was closed offline).
  track(waitForPendingWrites(db)).catch(() => undefined);
}

/** Wrap a Firestore write. Returns immediately-usable promise; UI should NOT await it when offline. */
export function track<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit();
  return p
    .then((v) => {
      lastError = null;
      return v;
    })
    .catch((e: unknown) => {
      lastError = e instanceof Error ? e.message : String(e);
      throw e;
    })
    .finally(() => {
      pending = Math.max(0, pending - 1);
      emit();
    });
}

/** Fire-and-forget write: queued locally, synced later. Errors are surfaced in the indicator. */
export function fire<T>(p: Promise<T>): void {
  track(p).catch((e) => console.error('[sync] write failed', e));
}

export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

/**
 * Remove every copy of this account's data from the device (the offline cache in IndexedDB),
 * so the next person to use this phone or browser can't dig it out. First gives queued
 * changes a few seconds to upload. The Firestore instance can't be used afterwards, so the
 * caller must reload the page.
 */
export async function wipeDeviceData(waitMs = 5000) {
  if (navigator.onLine) {
    await Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, waitMs))]).catch(() => undefined);
  }
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Another tab still has the cache open: it is cleared when that tab signs out or the next sign-in starts fresh.
  }
}
