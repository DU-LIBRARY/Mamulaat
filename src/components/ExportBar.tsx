import { useEffect, useRef, useState } from 'react';
import { useDialog } from './Dialog';

/** One quiet "Export" button that opens Week CSV · Month CSV · Print. Hidden when printing. */
export function ExportBar({ week, month, monthLabel }: { week?: () => void; month?: () => Promise<void> | void; monthLabel?: string }) {
  const { notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  // Close when tapping anywhere else.
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const run = async (fn: () => Promise<void> | void) => {
    if (ref.current) ref.current.open = false;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await notify('Could not export', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const item = 'flex min-h-11 w-full items-center px-4 text-left text-[15px] text-slate-800 hover:bg-slate-100 disabled:opacity-50';
  return (
    <details ref={ref} className="no-print relative ml-auto self-end">
      <summary className="btn-ghost min-h-11 cursor-pointer list-none px-3 text-sm [&::-webkit-details-marker]:hidden">{busy ? 'Preparing…' : 'Export ▾'}</summary>
      <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-surface py-1 shadow-lg" role="menu">
        {week && (
          <button role="menuitem" className={item} disabled={busy} onClick={() => run(week)}>
            Week CSV
          </button>
        )}
        {month && (
          <button role="menuitem" className={item} disabled={busy} onClick={() => run(month)}>
            {monthLabel ? `Month CSV (${monthLabel})` : 'Month CSV'}
          </button>
        )}
        <button role="menuitem" className={item} onClick={() => run(() => window.print())}>
          Print
        </button>
      </div>
    </details>
  );
}
