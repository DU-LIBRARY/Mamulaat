import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

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
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-ink py-2 pr-2 pl-4 text-white shadow-[0_12px_32px_-8px_rgb(16_34_79/0.5)]"
            >
              <span className="flex-1 text-sm" dir="auto">
                {toast.message}
              </span>
              <button className="btn min-h-9 rounded-full px-3 text-sm font-semibold text-gold-400 hover:bg-white/10" onClick={() => settle(true)}>
                Undo
              </button>
              {/* time left to undo */}
              <motion.span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gold-400/70"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: SHOW_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useUndo(): UndoApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUndo outside UndoProvider');
  return c;
}
