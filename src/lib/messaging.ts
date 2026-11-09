/**
 * Push notifications with the standard Web Push API (no Firebase Cloud Messaging, no Cloud Functions).
 *
 * Each device's push subscription is stored at users/{uid}/pushSubs/{id}. A GitHub Action
 * (.github/workflows/notifications.yml → tools/push/send-notifications.mjs) reads them and sends
 * the reminders, nudges and sign-up/approval notices, signed with the private half of the key pair
 * whose public half is in push.config.json.
 */
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { USE_EMULATORS, db } from '../firebase';
import { getSwRegistration, isIOS, isStandalone } from './pwa';
import { fire } from './sync';
import pushConfig from '../../push.config.json';

const SUB_KEY = 'mamulaat.pushSub'; // id of this device's pushSubs doc
const SUB_SEEN_KEY = 'mamulaat.pushSubSeen'; // day we last refreshed lastSeen
const OLD_FCM_KEYS = ['mamulaat.fcmToken', 'mamulaat.fcmTokenSeen'];

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'emulator' | 'no-vapid' | 'unsupported' | 'ios-not-installed' | 'denied' };

const PUBLIC_KEY: string = pushConfig.publicKey;

export async function pushSupport(): Promise<PushSupport> {
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-not-installed' };
  if (USE_EMULATORS) return { ok: false, reason: 'emulator' };
  if (!PUBLIC_KEY) return { ok: false, reason: 'no-vapid' };
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true };
}

export const pushSupportMessage: Record<Exclude<PushSupport, { ok: true }>['reason'], string> = {
  'ios-not-installed':
    'On iPhone/iPad, notifications only work after you add Mamūlāt to your Home Screen (Share → Add to Home Screen, iOS 16.4 or later) and open it from there.',
  emulator: 'Push notifications are not available when running against the local emulators.',
  'no-vapid': 'Push notifications are not configured for this app yet (missing push key).',
  unsupported: "This browser doesn't support push notifications. You'll still see a reminder banner when you open the app.",
  denied:
    'Notifications are blocked for this site. Allow them in your browser/site settings (on iPhone: Settings → Notifications → Mamūlāt) to get reminders. You will still see an in-app reminder banner.',
};

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/** A short, stable id for a subscription (one doc per device). */
async function subId(endpoint: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** This device's subscription for our key, creating it (or replacing an old Firebase one) if needed. */
async function currentSubscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await getSwRegistration();
  if (!reg) return null;
  const key = keyBytes(PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    // Made by the old Firebase messaging setup with a different key: start again.
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub;
}

async function saveSubscription(uid: string, sub: PushSubscription, force: boolean) {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return false;
  const id = await subId(json.endpoint);
  const prev = localStorage.getItem(SUB_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (prev && prev !== id) fire(deleteDoc(doc(db, 'users', uid, 'pushSubs', prev)));
  if (force || prev !== id || localStorage.getItem(SUB_SEEN_KEY) !== today) {
    fire(
      setDoc(
        doc(db, 'users', uid, 'pushSubs', id),
        {
          endpoint: json.endpoint,
          p256dh,
          auth,
          ...(prev !== id || force ? { createdAt: serverTimestamp() } : {}),
          lastSeen: serverTimestamp(),
          userAgent: navigator.userAgent.slice(0, 300),
        },
        { merge: true },
      ),
    );
    localStorage.setItem(SUB_KEY, id);
    localStorage.setItem(SUB_SEEN_KEY, today);
  }
  return true;
}

/** Forget the token left behind by the old Firebase messaging setup on this device. */
function dropOldFcmToken(uid: string) {
  const old = localStorage.getItem(OLD_FCM_KEYS[0]);
  if (old) fire(deleteDoc(doc(db, 'users', uid, 'fcmTokens', old)));
  OLD_FCM_KEYS.forEach((k) => localStorage.removeItem(k));
}

/** Ask permission, subscribe this device and store it under users/{uid}/pushSubs/{id}. */
export async function registerDevice(uid: string): Promise<PushSupport> {
  const support = await pushSupport();
  if (!support.ok) return support;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    dropOldFcmToken(uid);
    const sub = await currentSubscription(true);
    if (sub && (await saveSubscription(uid, sub, true))) return { ok: true };
  } catch (e) {
    console.warn('[push] could not subscribe', e);
  }
  return { ok: false, reason: 'unsupported' };
}

/**
 * Called on app start when notifications are on: subscriptions can change or expire, so make sure
 * this device's one is stored and current. Never prompts.
 */
export async function refreshToken(uid: string): Promise<void> {
  try {
    const s = await pushSupport();
    if (!s.ok || Notification.permission !== 'granted') return;
    dropOldFcmToken(uid);
    const sub = await currentSubscription(true);
    if (sub) await saveSubscription(uid, sub, false);
  } catch (e) {
    console.warn('[push] could not refresh subscription', e);
  }
}

export async function unregisterDevice(uid: string) {
  const id = localStorage.getItem(SUB_KEY);
  localStorage.removeItem(SUB_KEY);
  localStorage.removeItem(SUB_SEEN_KEY);
  if (id) fire(deleteDoc(doc(db, 'users', uid, 'pushSubs', id)));
  dropOldFcmToken(uid);
  try {
    const sub = await currentSubscription(false);
    await sub?.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Pushes that arrive while the app is open: the service worker passes them on so the UI can show a toast too. */
export async function onForegroundMessage(cb: (title: string, body: string) => void) {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'push') cb(String(e.data.title ?? 'Mamūlāt'), String(e.data.body ?? ''));
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
function time12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}
/** "Every day at 11pm, and Fridays at 12pm": the fixed reminder times from push.config.json. */
export function reminderSchedule(): string {
  const r: { time: string; weekday?: number }[] = pushConfig.reminders ?? [];
  const parts = r.map((x) => (x.weekday == null ? `every day at ${time12(x.time)}` : `${DAYS[x.weekday]} at ${time12(x.time)}`));
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0] ?? '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
