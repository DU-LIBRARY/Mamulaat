import { useSyncExternalStore } from 'react';
import { applyUpdate, getUpdateReady, subscribeUpdate } from '../lib/pwa';

/** Shown when a new version of the app has been downloaded in the background. */
export function UpdatePrompt() {
  const ready = useSyncExternalStore(subscribeUpdate, getUpdateReady);
  if (!ready) return null;
  return (
    <div role="status" className="pt-safe fixed inset-x-0 top-0 z-[70] bg-gold-400 text-brand-900 shadow">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <span className="flex-1 text-sm font-semibold">A new version of Mamulaat is available.</span>
        <button className="btn bg-brand-900 text-white" onClick={() => applyUpdate()}>
          Tap to update
        </button>
      </div>
    </div>
  );
}
