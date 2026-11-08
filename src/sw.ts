/// <reference lib="webworker" />
/**
 * ONE service worker for both jobs:
 *  1. PWA: precache the app shell (Workbox, manifest injected by vite-plugin-pwa)
 *     and serve index.html for navigations so the app opens fully offline.
 *  2. Web push (sent through Firebase Cloud Messaging): show reminder notifications.
 *
 * The page passes this registration to getToken({ serviceWorkerRegistration }),
 * so there is no separate firebase-messaging-sw.js.
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

// ---------- Push (FCM) ----------
// We handle the `push` event ourselves instead of using firebase/messaging/sw, because the SDK
//  - does NOT show a notification when any app window is visible (it forwards the message to the
//    page instead), and
//  - on iOS/Safari every push MUST show a notification, or Safari silently revokes the push
//    subscription after a few pushes, so reminders stop arriving with no error anywhere.
// So: every push always shows a notification. FCM tokens are still created by the page via
// getToken({ serviceWorkerRegistration }) against this same registration.
interface PushData {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

function readPush(event: PushEvent): PushData {
  if (!event.data) return {};
  try {
    const json = event.data.json() as { data?: PushData; notification?: PushData } & PushData;
    // FCM web push wraps data-only messages as { data: {...}, from, fcmMessageId, ... }.
    return { ...json.notification, ...json.data, ...(json.title ? { title: json.title, body: json.body } : {}) };
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = readPush(event);
  const title = data.title || 'Mamulaat';
  const body = data.body || "You haven't logged your mamoolaat today.";
  const scope = self.registration.scope;
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        icon: new URL('icons/icon-192.png', scope).href,
        badge: new URL('icons/badge-72.png', scope).href,
        tag: data.tag || 'mamulaat-reminder',
        data: { url: new URL(data.url || '.', scope).href },
      });
      // Let an open app react too (e.g. refresh a banner); it never replaces the notification.
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) c.postMessage({ type: 'mamulaat-push', title, body });
    })(),
  );
});

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
