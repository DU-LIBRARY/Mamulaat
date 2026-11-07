import { useSyncState } from '../lib/sync';

export function SyncIndicator() {
  const { online, pending, lastError } = useSyncState();
  let label: string;
  let cls: string;
  let dot: string;
  if (!online) {
    label = pending ? `Offline · ${pending} to sync` : 'Offline';
    cls = 'bg-slate-200 text-slate-700';
    dot = 'bg-slate-500';
  } else if (pending) {
    label = 'Syncing…';
    cls = 'bg-amber-100 text-amber-800';
    dot = 'bg-amber-500 animate-pulse';
  } else if (lastError) {
    label = 'Sync error';
    cls = 'bg-red-100 text-red-700';
    dot = 'bg-red-500';
  } else {
    label = 'Synced';
    cls = 'bg-brand-50 text-brand-700';
    dot = 'bg-brand-500';
  }
  return (
    <span className={`chip gap-1.5 ${cls}`} role="status" aria-live="polite" title={lastError ?? undefined}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function StaleDataNotice() {
  const { online } = useSyncState();
  if (online) return null;
  return (
    <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
      You're offline — data shown here may be out of date. Admin views work best online.
    </div>
  );
}
