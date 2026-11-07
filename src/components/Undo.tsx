import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * "Done · Undo" toasts, used instead of "Are you sure?" dialogs for small, reversible actions.
 *
 *  - undoable(message, undo): the action has ALREADY happened; Undo reverses it.
 *  - deferred(message, commit): the action happens when the toast goes away (after a few
 *    seconds, when another action replaces it, or when the page is closed); Undo cancels it.
 *    Used for real deletes, which cannot be reversed afterwards.
 */
interface UndoApi {
  undoable: (message: string, undo: () => void) => void;
  deferred: (message: string, commit: () => void) => void;
}

interface Toast {
  id: number;
  message: string;
  undo: () => void;
  /** For deferred actions: run this when the toast closes without Undo. */
  commit?: () => void;
}

const SHOW_MS = 6000;
const Ctx = createContext<UndoApi | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const current = useRef<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  /** Close the current toast; a pending deferred action is committed unless it was undone. */
  const settle = useCallback((undone: boolean) => {
    const t = current.current;
    if (!t) return;
    current.current = null;
    clearTimeout(timer.current);
    if (undone) t.undo();
    else t.commit?.();
    setToast(null);
  }, []);

  const show = useCallback(
    (t: Omit<Toast, 'id'>) => {
      settle(false); // a new action finalises the previous one
      const next = { ...t, id: ++seq.current };
      current.current = next;
      setToast(next);
      timer.current = setTimeout(() => settle(false), SHOW_MS);
    },
    [settle],
  );

  // Never lose a deferred delete because the app was closed or hidden.
  useEffect(() => {
    const flush = () => settle(false);
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [settle]);

  const api: UndoApi = {
    undoable: (message, undo) => show({ message, undo }),
    deferred: (message, commit) => show({ message, undo: () => undefined, commit }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="update-prompt fixed inset-x-3 z-[65] mx-auto max-w-md" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="flex items-center gap-3 rounded-lg bg-slate-900 py-2 pr-2 pl-4 text-white shadow-lg">
            <span className="flex-1 text-sm" dir="auto">
              {toast.message}
            </span>
            <button className="btn min-h-9 px-3 text-sm font-semibold text-gold-400 hover:bg-white/10" onClick={() => settle(true)}>
              Undo
            </button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useUndo(): UndoApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUndo outside UndoProvider');
  return c;
}
