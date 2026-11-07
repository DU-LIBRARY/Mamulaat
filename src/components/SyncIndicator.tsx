import { useSyncState } from '../lib/sync';
import { Notice } from './ui';

export function SyncIndicator() {
  const { online, pending, lastError } = useSyncState();
  let label: string;
  let dot: string;
  if (!online) {
    label = pending ? `Offline · ${pending} to sync` : 'Offline';
    dot = 'bg-slate-400';
  } else if (pending) {
    label = 'Saving…';
    dot = 'bg-amber-500 animate-pulse';
  } else if (lastError) {
    label = 'Sync error';
    dot = 'bg-red-600';
  } else {
    label = 'Saved';
    dot = 'bg-brand-500';
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" role="status" aria-live="polite" title={lastError ?? undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function StaleDataNotice() {
  const { online } = useSyncState();
  if (online) return null;
  return (
    <div className="mb-4">
      <Notice tone="warn">You're offline, so the data here may be out of date. Admin views work best online.</Notice>
    </div>
  );
}
