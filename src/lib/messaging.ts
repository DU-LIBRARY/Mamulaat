import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, USE_EMULATORS, VAPID_KEY, db } from '../firebase';
import { getSwRegistration, isIOS, isStandalone } from './pwa';
import { fire } from './sync';

const TOKEN_KEY = 'mamulaat.fcmToken';
const TOKEN_SEEN_KEY = 'mamulaat.fcmTokenSeen';

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'emulator' | 'no-vapid' | 'unsupported' | 'ios-not-installed' | 'denied' };

let messagingP: Promise<Messaging | null> | null = null;
function messaging() {
  messagingP ??= isSupported()
    .then((s) => (s ? getMessaging(app) : null))
    .catch(() => null);
  return messagingP;
}

export async function pushSupport(): Promise<PushSupport> {
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-not-installed' };
  if (USE_EMULATORS) return { ok: false, reason: 'emulator' };
  if (!VAPID_KEY) return { ok: false, reason: 'no-vapid' };
  if (!('Notification' in window) || !(await messaging())) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true };
}

export const pushSupportMessage: Record<Exclude<PushSupport, { ok: true }>['reason'], string> = {
  'ios-not-installed':
    'On iPhone/iPad, reminders only work after you add Mamulaat to your Home Screen (Share → Add to Home Screen, iOS 16.4 or later) and open it from there.',
  emulator: 'Push notifications are not available when running against the local emulators.',
  'no-vapid': 'Push notifications are not configured for this app yet (missing VAPID key).',
  unsupported: "This browser doesn't support web push notifications. You'll still see a reminder banner when you open the app.",
  denied:
    'Notifications are blocked for this site. Allow them in your browser/site settings to get reminders. You will still see an in-app reminder banner.',
};

/** Ask permission, get a token and store it under users/{uid}/fcmTokens/{token}. */
export async function registerDevice(uid: string): Promise<PushSupport> {
  const support = await pushSupport();
  if (!support.ok) return support;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  return (await refreshToken(uid, true)) ? { ok: true } : { ok: false, reason: 'unsupported' };
}

/**
 * Called on app start when reminders are on: tokens can rotate or expire, so we
 * re-fetch and replace the stored one if it changed. Never prompts.
 */
export async function refreshToken(uid: string, force = false): Promise<string | null> {
  try {
    if (!force) {
      const s = await pushSupport();
      if (!s.ok || Notification.permission !== 'granted') return null;
    }
    const m = await messaging();
    const reg = await getSwRegistration();
    if (!m || !reg) return null;
    const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return null;
    const prev = localStorage.getItem(TOKEN_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (prev && prev !== token) fire(deleteDoc(doc(db, 'users', uid, 'fcmTokens', prev)));
    if (prev !== token || localStorage.getItem(TOKEN_SEEN_KEY) !== today) {
      fire(
        setDoc(
          doc(db, 'users', uid, 'fcmTokens', token),
          {
            ...(prev !== token ? { createdAt: serverTimestamp() } : {}),
            lastSeen: serverTimestamp(),
            userAgent: navigator.userAgent.slice(0, 300),
          },
          { merge: true },
        ),
      );
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_SEEN_KEY, today);
    }
    return token;
  } catch (e) {
    console.warn('[fcm] could not get token', e);
    return null;
  }
}

export async function unregisterDevice(uid: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_SEEN_KEY);
  if (token) fire(deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)));
  try {
    const m = await messaging();
    if (m) await deleteToken(m);
  } catch {
    /* ignore */
  }
}

/** Is THIS device set up to receive pushes (permission granted and a token stored)? */
export function deviceHasPush(): boolean {
  try {
    return 'Notification' in window && Notification.permission === 'granted' && !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

export type TestResult = { ok: true; text: string } | { ok: false; text: string };

/**
 * Send a real push through FCM to all of my devices (Cloud Function `sendTestNotification`).
 * If the functions aren't deployed, falls back to a local notification so at least the
 * device side (permission + service worker) can be checked.
 */
export async function sendTestNotification(): Promise<TestResult> {
  try {
    const call = httpsCallable<unknown, { sent: number; removed: number }>(getFunctions(app, 'us-central1'), 'sendTestNotification');
    const { data } = await call({});
    if (data.sent > 0)
      return { ok: true, text: `Test sent to ${data.sent} device${data.sent === 1 ? '' : 's'}. It should appear within a few seconds (close or switch away from the app if you don't see it).` };
    return { ok: false, text: 'No device is registered for notifications. Turn notifications on for this device first.' };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.endsWith('resource-exhausted')) return { ok: false, text: 'Please wait a few seconds and try again.' };
    // Function not deployed / no network: check the device side locally instead.
    try {
      const reg = await getSwRegistration();
      if (reg && Notification.permission === 'granted') {
        await reg.showNotification('Mamulaat', {
          body: 'This device can show notifications.',
          icon: new URL('icons/icon-192.png', reg.scope).href,
          tag: 'test-local',
        });
        return {
          ok: false,
          text: "This device can show notifications, but the server couldn't send one. The reminder Cloud Functions may not be deployed yet (see the README), or you're offline.",
        };
      }
    } catch {
      /* fall through */
    }
    return { ok: false, text: `Couldn't send a test notification${code ? ` (${code})` : ''}.` };
  }
}
