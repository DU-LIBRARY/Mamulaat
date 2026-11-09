import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog as RDialog } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';

/**
 * In-page replacements for window.confirm / prompt / alert. The browser's own dialogs
 * block the page, look out of place in an installed app, and are suppressed by some
 * mobile browsers, so every confirmation in the app goes through here.
 * Built on Radix's Dialog primitive (focus trap, Escape, focus return, aria wiring) and
 * animated with Motion: a bottom sheet on phones, a centred card on wider screens.
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
      <RDialog.Root open={!!req} onOpenChange={(o) => !o && close(false)}>
        <AnimatePresence>{req && <DialogView key="dlg" req={req} typed={typed} setTyped={setTyped} close={close} />}</AnimatePresence>
      </RDialog.Root>
    </Ctx.Provider>
  );
}

function DialogView({ req, typed, setTyped, close }: { req: Request; typed: string; setTyped: (v: string) => void; close: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const canConfirm = !req.requireText || typed === req.requireText;

  return (
    <RDialog.Portal forceMount>
      <RDialog.Overlay asChild forceMount>
        <motion.div
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      </RDialog.Overlay>
      <div className="pointer-events-none fixed inset-0 z-[61] flex items-end justify-center p-3 sm:items-center sm:p-4">
        <RDialog.Content
          asChild
          forceMount
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            ref.current?.querySelector<HTMLElement>('input, button[data-primary]')?.focus();
          }}
        >
          <motion.div
            ref={ref}
            className="pb-safe pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200/70 bg-surface p-5 shadow-[0_24px_60px_-12px_rgb(16_34_79/0.35)]"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <RDialog.Title className="text-lg font-semibold tracking-[-0.01em] text-slate-900" dir="auto">
              {req.title}
            </RDialog.Title>
            {req.message ? (
              <RDialog.Description asChild>
                <div className="mt-2 text-sm leading-relaxed text-slate-600" dir="auto">
                  {req.message}
                </div>
              </RDialog.Description>
            ) : (
              <RDialog.Description className="sr-only">{req.title}</RDialog.Description>
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
          </motion.div>
        </RDialog.Content>
      </div>
    </RDialog.Portal>
  );
}

export function useDialog(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialog outside DialogProvider');
  return c;
}
