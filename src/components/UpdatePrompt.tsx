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
      <div className="flex items-center gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-white shadow-lg">
        <span className="flex-1 text-sm">A new version of Mamūlāt is ready.</span>
        <button className="btn min-h-9 bg-white px-3 text-sm text-ink hover:bg-white/90" onClick={() => applyUpdate()}>
          Update
        </button>
      </div>
    </div>
  );
}
