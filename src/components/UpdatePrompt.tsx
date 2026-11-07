import { useSyncExternalStore } from 'react';
import { applyUpdate, getUpdateReady, subscribeUpdate } from '../lib/pwa';

/** Shown when a new version of the app has been downloaded in the background. */
export function UpdatePrompt() {
  const ready = useSyncExternalStore(subscribeUpdate, getUpdateReady);
  if (!ready) return null;
  return (
    // Floats above the bottom nav rather than at the top of the screen: on iOS the
    // status-bar area (clock, notch/Dynamic Island and its blur) swallows taps, so a
    // banner pinned to the top could be impossible to press.
    <div role="status" className="update-prompt fixed inset-x-3 z-[70] mx-auto max-w-md">
      <div className="flex items-center gap-3 rounded-2xl bg-gold-400 px-4 py-3 text-brand-900 shadow-lg ring-1 ring-brand-900/10">
        <span className="flex-1 text-sm font-semibold">A new version of Mamulaat is available.</span>
        <button className="btn bg-brand-900 text-white" onClick={() => applyUpdate()}>
          Tap to update
        </button>
      </div>
    </div>
  );
}
