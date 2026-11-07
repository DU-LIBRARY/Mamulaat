import { registerSW } from 'virtual:pwa-register';

let registration: ServiceWorkerRegistration | undefined;
const waiters: Array<(r: ServiceWorkerRegistration | undefined) => void> = [];

/** Register the single app service worker (PWA shell + FCM). */
export function initPwa() {
  if (!('serviceWorker' in navigator)) {
    waiters.splice(0).forEach((w) => w(undefined));
    return;
  }
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r;
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
