import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ db: {} }));
const server = new Map<string, unknown>();
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  waitForPendingWrites: async () => undefined,
  getDocFromServer: async (ref: string) => ({ data: () => server.get(ref) }),
}));

// No browser here: a small stand-in for localStorage, and "online".
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal('navigator', { onLine: true });

const { checkLeftovers, dismissLost, noteWrite } = await import('../../src/lib/unsynced');

const KEY = (uid: string) => `mamulaat.unsynced.${uid}`;
const state = (uid: string) => JSON.parse(localStorage.getItem(KEY(uid)) ?? '{"waiting":[],"lost":[]}');
const tick = () => new Promise((r) => setTimeout(r, 0));
const refused = () => Promise.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));

describe('entries that never reach the server', () => {
  beforeEach(() => {
    localStorage.clear();
    server.clear();
  });

  it('forgets a write once the server accepts it', async () => {
    noteWrite('u1', 'logs', '2026-11-01', { m1: { status: 'done' } }, Promise.resolve());
    expect(state('u1').waiting).toHaveLength(1);
    await tick();
    expect(state('u1')).toEqual({ waiting: [], lost: [] });
  });

  it('lists the day as not saved when the server refuses it, until dismissed', async () => {
    noteWrite('u2', 'salah', '2026-11-01', { fajr: 'jamaat' }, refused());
    await tick();
    expect(state('u2').lost).toEqual([{ kind: 'salah', day: '2026-11-01' }]);
    expect(state('u2').waiting).toEqual([]);
    dismissLost('u2');
    expect(localStorage.getItem(KEY('u2'))).toBeNull();
  });

  it('keeps waiting through a network error (the write is still queued)', async () => {
    noteWrite('u3', 'logs', '2026-11-01', { m1: null }, Promise.reject(new Error('offline')));
    await tick();
    expect(state('u3').waiting).toHaveLength(1);
    expect(state('u3').lost).toEqual([]);
  });

  it('after a restart, checks leftovers against the server', async () => {
    localStorage.setItem(
      KEY('u4'),
      JSON.stringify({
        waiting: [
          { kind: 'logs', day: '2026-11-01', ids: { m1: { status: 'done', amount: 1, target: 1 } } }, // arrived
          { kind: 'logs', day: '2026-11-02', ids: { m1: { status: 'done', amount: 1, target: 1 } } }, // refused
          { kind: 'salah', day: '2026-11-02', ids: { fajr: null } }, // a cleared entry that is indeed absent
          { kind: 'salah', day: '2026-11-03', ids: { fajr: 'jamaat' } }, // the teacher has since edited this day
        ],
        lost: [],
      }),
    );
    server.set('users/u4/logs/2026-11-01', { entries: { m1: { target: 1, amount: 1, status: 'done' } } });
    server.set('users/u4/salah/2026-11-03', { entries: { fajr: 'missed' }, editedBy: 'admin' });
    await checkLeftovers('u4');
    expect(state('u4')).toEqual({ waiting: [], lost: [{ kind: 'logs', day: '2026-11-02' }] });
  });
});
