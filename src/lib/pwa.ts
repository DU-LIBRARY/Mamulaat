import { registerSW } from 'virtual:pwa-register';

let registration: ServiceWorkerRegistration | undefined;
let updateReady = false;
const updateListeners = new Set<() => void>();

/** Subscribe to "a new version is downloaded and waiting" (for the update prompt). */
export function subscribeUpdate(l: () => void) {
  updateListeners.add(l);
  return () => updateListeners.delete(l);
}
export const getUpdateReady = () => updateReady;

let reloading = false;
function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

/**
 * Activate the waiting service worker and reload into the new version.
 *
 * We don't rely on workbox-window here: Safari doesn't always fire `controllerchange` after
 * skipWaiting (notably in home-screen apps), which left the page stuck on the old version.
 * So we reload on whichever comes first: the new worker taking control, it reaching
 * "activated", or a short timeout.
 */
export function applyUpdate(): Promise<void> {
  const waiting = registration?.waiting;
  if (!waiting) {
    reloadOnce();
    return Promise.resolve();
  }
  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });
  waiting.addEventListener('statechange', () => {
    if (waiting.state === 'activated' || waiting.state === 'redundant') reloadOnce();
  });
  setTimeout(reloadOnce, 3000);
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return Promise.resolve();
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

function markUpdateReady() {
  // Only an update if something is already controlling the page (not the very first install).
  if (!navigator.serviceWorker.controller || !registration?.waiting) return;
  updateReady = true;
  applyIfIdle();
}

/**
 * Watch the registration ourselves for new versions. workbox-window only reports the first
 * update found after ~1 minute and then stops listening, so an app left open (which Safari /
 * iOS does for days, resuming it instead of reloading) never saw later deploys.
 */
function watchRegistration(r: ServiceWorkerRegistration) {
  const track = (sw: ServiceWorker | null) => {
    if (!sw) return;
    if (sw.state === 'installed') markUpdateReady();
    else sw.addEventListener('statechange', () => sw.state === 'installed' && markUpdateReady());
  };
  if (r.waiting) markUpdateReady(); // installed during an earlier visit, still waiting
  track(r.installing);
  r.addEventListener('updatefound', () => track(r.installing));
}

/** Register the single app service worker (PWA shell + Web Push). */
export function initPwa() {
  if (!('serviceWorker' in navigator)) {
    waiters.splice(0).forEach((w) => w(undefined));
    return;
  }
  for (const ev of ['pointerdown', 'keydown', 'input']) window.addEventListener(ev, markInteracted, { capture: true, passive: true });
  registerSW({
    immediate: true,
    // Update detection and reloading are handled below (see watchRegistration / applyUpdate).
    onNeedReload: reloadOnce,
    onRegisteredSW(_url, r) {
      registration = r;
      // Look for a new version on open, whenever the app comes back to the front or online,
      // and every few minutes while it's open, so a deploy reaches everyone quickly.
      if (r) {
        watchRegistration(r);
        const check = () => {
          if (navigator.onLine) r.update().catch(() => undefined);
          applyIfIdle();
        };
        const resumed = () => {
          interacted = false; // freshly reopened: safe to update until they tap something
          check();
        };
        setInterval(check, CHECK_EVERY_MS);
        window.addEventListener('online', check);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') resumed();
          else applyIfIdle();
        });
        // Safari restores pages from its back/forward cache without a visibilitychange.
        window.addEventListener('pageshow', (e) => e.persisted && resumed());
        check();
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

// ---------- Install ("Add to Home screen") ----------
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installEvent: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // Chrome / Edge / Samsung Internet on Android fire this when the app can be installed.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    notifyInstall();
  });
}

export const canPromptInstall = () => installEvent !== null;
export function subscribeInstall(l: () => void) {
  installListeners.add(l);
  return () => installListeners.delete(l);
}
/** Show the browser's own install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = installEvent;
  if (!e) return false;
  installEvent = null; // the event can only be used once
  notifyInstall();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}
