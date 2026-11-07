/// <reference lib="webworker" />
/**
 * ONE service worker for both jobs:
 *  1. PWA: precache the app shell (Workbox, manifest injected by vite-plugin-pwa)
 *     and serve index.html for navigations so the app opens fully offline.
 *  2. Firebase Cloud Messaging: receive reminder pushes in the background.
 *
 * The page passes this registration to getToken({ serviceWorkerRegistration }),
 * so there is no separate firebase-messaging-sw.js.
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

// A new worker waits until the user taps "update" (the page sends SKIP_WAITING), so the page
// is never swapped under someone mid-edit. clientsClaim only matters on the very first install.
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

// ---------- FCM ----------
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (config.apiKey && config.messagingSenderId && import.meta.env.VITE_USE_EMULATORS !== 'true') {
  try {
    const messaging = getMessaging(initializeApp(config));
    // The reminder function sends data-only messages, so we display the notification ourselves.
    onBackgroundMessage(messaging, (payload) => {
      const data = payload.data ?? {};
      const title = data.title || payload.notification?.title || 'Mamulaat';
      const body = data.body || payload.notification?.body || "You haven't logged your mamoolaat today.";
      return self.registration.showNotification(title, {
        body,
        icon: new URL('icons/icon-192.png', self.registration.scope).href,
        badge: new URL('icons/badge-72.png', self.registration.scope).href,
        tag: data.tag || 'mamulaat-reminder',
        data: { url: new URL(data.url || '.', self.registration.scope).href },
      });
    });
  } catch (e) {
    console.warn('[sw] FCM unavailable', e);
  }
}

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
