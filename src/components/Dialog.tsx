import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * In-page replacements for window.confirm / prompt / alert. The browser's own dialogs
 * block the page, look out of place in an installed app, and are suppressed by some
 * mobile browsers, so every confirmation in the app goes through here.
 */
export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. */
  danger?: boolean;
  /** The user must type this exact text before the confirm button is enabled. */
  requireText?: string;
}

interface Request extends ConfirmOptions {
  kind: 'confirm' | 'notice';
  resolve: (ok: boolean) => void;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** A message with a single OK button. */
  notify: (title: string, message?: ReactNode) => Promise<void>;
}

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [typed, setTyped] = useState('');

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setReq({ ...o, kind: 'confirm', resolve });
      }),
    [],
  );
  const notify = useCallback(
    (title: string, message?: ReactNode) =>
      new Promise<void>((resolve) => {
        setReq({ title, message, kind: 'notice', confirmLabel: 'OK', resolve: () => resolve() });
      }),
    [],
  );

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  return (
    <Ctx.Provider value={{ confirm, notify }}>
      {children}
      {req && <DialogView req={req} typed={typed} setTyped={setTyped} close={close} />}
    </Ctx.Provider>
  );
}

function DialogView({ req, typed, setTyped, close }: { req: Request; typed: string; setTyped: (v: string) => void; close: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const canConfirm = !req.requireText || typed === req.requireText;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button[data-primary]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = ref.current?.querySelectorAll<HTMLElement>('input, select, textarea, a[href], button:not(:disabled)');
        if (!f?.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby={req.message ? 'dlg-desc' : undefined} className="pb-safe w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
        <h2 id="dlg-title" className="text-lg font-semibold text-slate-900" dir="auto">
          {req.title}
        </h2>
        {req.message && (
          <div id="dlg-desc" className="mt-2 text-sm text-slate-600" dir="auto">
            {req.message}
          </div>
        )}
        {req.requireText && (
          <div className="mt-3">
            <label className="label" htmlFor="dlg-type">
              Type <b>{req.requireText}</b> to confirm
            </label>
            <input id="dlg-type" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="off" autoCorrect="off" autoComplete="off" />
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {req.kind === 'confirm' && (
            <button className="btn-secondary" onClick={() => close(false)}>
              {req.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button data-primary className={req.danger ? 'btn-danger' : 'btn-primary'} disabled={!canConfirm} onClick={() => close(true)}>
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useDialog(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialog outside DialogProvider');
  return c;
}
