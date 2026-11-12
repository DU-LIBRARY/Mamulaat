/// <reference lib="webworker" />
/**
 * ONE service worker for both jobs:
 *  1. PWA: precache the app shell (Workbox, manifest injected by vite-plugin-pwa)
 *     and serve index.html for navigations so the app opens fully offline.
 *  2. Web Push: show the reminder / nudge / sign-up notifications sent by the
 *     "Notifications" GitHub Action, even when the app is closed.
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// A new worker waits until the page sends SKIP_WAITING: automatically when the app is opened or
// in the background (nobody mid-edit), otherwise when the user taps "update". clientsClaim only matters on the very first install.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();

const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
cleanupOutdatedCaches();

// SPA navigations -> cached index.html. Never intercept Firebase's reserved /__/ URLs
// (the Google sign-in handler lives at /__/auth/handler).
// (In `vite dev` the manifest is empty, so this is only registered in production builds.)
if (manifest.some((e) => (typeof e === 'string' ? e : e.url) === 'index.html')) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__\//] }));
}

// ---------- Web Push ----------
// Sent by the "Notifications" GitHub Action (tools/push/send-notifications.mjs) as JSON:
// { title, body, url, tag }, where url is relative to the app (e.g. "." or "admin/students").
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'Mamūlāt';
  const body = data.body || "You haven't logged your mamoolaat today.";
  event.waitUntil(
    (async () => {
      // An open app shows a toast as well (see onForegroundMessage in src/lib/messaging.ts).
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      open.forEach((c) => c.postMessage({ type: 'push', title, body }));
      await self.registration.showNotification(title, {
        body,
        icon: new URL('icons/v3/icon-192.png', self.registration.scope).href,
        badge: new URL('icons/v3/badge-72.png', self.registration.scope).href,
        tag: data.tag || 'mamulaat',
        data: { url: new URL(data.url || '.', self.registration.scope).href },
      });
    })(),
  );
});

// The browser replaced the subscription (rare): the app re-registers it the next time it opens.
self.addEventListener('pushsubscriptionchange', () => undefined);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await (c as WindowClient).navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
