import { registerSW } from 'virtual:pwa-register';

let registration: ServiceWorkerRegistration | undefined;
let updateReady = false;
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
const updateListeners = new Set<() => void>();

/** Subscribe to "a new version is downloaded and waiting" (for the update prompt). */
export function subscribeUpdate(l: () => void) {
  updateListeners.add(l);
  return () => updateListeners.delete(l);
}
export const getUpdateReady = () => updateReady;
/** Activate the waiting service worker and reload into the new version. */
export function applyUpdate() {
  return updateSW?.(true) ?? Promise.resolve(window.location.reload());
}
const waiters: Array<(r: ServiceWorkerRegistration | undefined) => void> = [];

// Has the person started using the page since it was opened / brought back to the front?
// Until they have, a new version can be swapped in without interrupting anything.
let interacted = false;
const markInteracted = () => (interacted = true);
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Swap in a downloaded update now if nobody is mid-task, otherwise show the prompt. */
function applyIfIdle() {
  if (!updateReady) return;
  if (!interacted || document.visibilityState === 'hidden') {
    void applyUpdate();
  } else {
    updateListeners.forEach((l) => l());
  }
}

/** Register the single app service worker (PWA shell + FCM). */
export function initPwa() {
  if (!('serviceWorker' in navigator)) {
    waiters.splice(0).forEach((w) => w(undefined));
    return;
  }
  for (const ev of ['pointerdown', 'keydown', 'input']) window.addEventListener(ev, markInteracted, { capture: true, passive: true });
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      applyIfIdle();
    },
    onRegisteredSW(_url, r) {
      registration = r;
      // Look for a new version on open, whenever the app comes back to the front or online,
      // and every few minutes while it's open, so a deploy reaches everyone quickly.
      if (r) {
        const check = () => navigator.onLine && r.update().catch(() => undefined);
        setInterval(check, CHECK_EVERY_MS);
        window.addEventListener('online', check);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            interacted = false; // freshly reopened: safe to update until they tap something
            check();
          }
          applyIfIdle();
        });
      }
      waiters.splice(0).forEach((w) => w(r));
    },
    onRegisterError(e) {
      console.warn('[pwa] service worker registration failed', e);
      waiters.splice(0).forEach((w) => w(undefined));
    },
  });
}

export function getSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (registration) return Promise.resolve(registration);
  if (!('serviceWorker' in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    waiters.push(resolve);
    // fall back to whatever is active
    navigator.serviceWorker.ready.then((r) => resolve(r)).catch(() => undefined);
  });
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
