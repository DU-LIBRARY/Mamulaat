import { useSyncExternalStore } from 'react';
import { applyUpdate, getUpdateReady, subscribeUpdate } from '../lib/pwa';

/** Shown when a new version of the app has been downloaded in the background. */
export function UpdatePrompt() {
  const ready = useSyncExternalStore(subscribeUpdate, getUpdateReady);
  if (!ready) return null;
  return (
    <div role="status" className="pb-safe fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-md">
      <div className="flex items-center gap-3 rounded-lg bg-slate-900 py-2 pr-2 pl-4 text-white shadow-lg">
        <span className="flex-1 text-sm">A new version of Mamulaat is ready.</span>
        <button className="btn min-h-9 bg-white px-3 text-sm text-slate-900 hover:bg-slate-100" onClick={() => applyUpdate()}>
          Update
        </button>
      </div>
    </div>
  );
}
