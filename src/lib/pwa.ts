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

/** Register the single app service worker (PWA shell + FCM). */
export function initPwa() {
  if (!('serviceWorker' in navigator)) {
    waiters.splice(0).forEach((w) => w(undefined));
    return;
  }
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      updateListeners.forEach((l) => l());
    },
    onRegisteredSW(_url, r) {
      registration = r;
      // Look for a new version when the app is reopened and every hour, so installed
      // PWAs notice a deploy without needing a manual reload.
      if (r) {
        const check = () => navigator.onLine && r.update().catch(() => undefined);
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
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
