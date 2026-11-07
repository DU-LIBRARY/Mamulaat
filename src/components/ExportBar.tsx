import { useState } from 'react';
import { useDialog } from './Dialog';

/** "Week CSV · Month CSV · Print" buttons. Hidden when printing. */
export function ExportBar({ week, month, monthLabel }: { week?: () => void; month?: () => Promise<void> | void; monthLabel?: string }) {
  const { notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await notify('Could not export', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="no-print flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Export">
      {week && (
        <button className="btn-secondary min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(week)}>
          Week CSV
        </button>
      )}
      {month && (
        <button className="btn-secondary min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(month)} aria-label={monthLabel ? `Month CSV for ${monthLabel}` : undefined}>
          {busy ? 'Preparing…' : 'Month CSV'}
        </button>
      )}
      <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
