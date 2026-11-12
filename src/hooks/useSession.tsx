import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  EmailAuthProvider,
  getRedirectResult,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  unlink,
  updatePassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, googleProvider } from '../firebase';
import { wipeDeviceData } from '../lib/sync';
import { clearUnsynced } from '../lib/unsynced';
import {
  createPendingProfile,
  normalizeSettings,
  refreshOffsetIfNeeded,
  settingsRef,
  updateOwnProfile,
  userRef,
  type Actor,
} from '../lib/db';
import { todayIn } from '../lib/dates';
import type { AppSettings, UserProfile } from '../types';

interface Session {
  user: User | null | undefined; // undefined = still loading
  profile: UserProfile | null | undefined;
  profileError: Error | null;
  settings: AppSettings;
  settingsLoaded: boolean;
  today: string;
  actor: Actor | null;
  /** Signed in on the teacher's side: the admin, or a limited admin ("assistant"). */
  isAdmin: boolean;
  /** A limited admin: runs the app like the admin but can't see anyone's mamoolaat, logs or salah. */
  limited: boolean;
  /** True after the admin deleted this signed-in account (we then sign out). */
  removed: boolean;
  dismissRemoved: () => void;
  signIn: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Add (or change) an email + password sign-in on the signed-in account. */
  setPassword: (password: string) => Promise<void>;
  removePassword: () => Promise<void>;
  hasPassword: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [rawSettings, setRawSettings] = useState<AppSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [removed, setRemoved] = useState(false);
  const hadProfile = useRef(false);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => console.warn('[auth] redirect result', e));
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setProfile(null);
    });
  }, []);

  // Live profile (from cache when offline). Create a pending profile on first sign-in.
  useEffect(() => {
    if (!user) return;
    setProfile(undefined);
    hadProfile.current = false;
    let creating = false;
    return onSnapshot(
      userRef(user.uid),
      (snap) => {
        setProfileError(null);
        if (!snap.exists()) {
          if (snap.metadata.fromCache) return; // wait for the server before deciding it's new
          if (hadProfile.current) {
            // The profile existed in this session and is now gone: the admin deleted the account.
            // Do NOT silently create a new pending profile; tell the person and sign out.
            hadProfile.current = false;
            setRemoved(true);
            setProfile(null);
            fbSignOut(auth).catch(() => undefined);
            wipeDeviceData(0); // their data is gone from the server; remove the device copy too
            return;
          }
          if (!creating) {
            creating = true;
            createPendingProfile({
              uid: user.uid,
              email: user.email ?? '',
              displayName: user.displayName,
              photoURL: user.photoURL,
            }).catch((e) => setProfileError(e));
          }
          return;
        }
        const p = { id: snap.id, ...snap.data() } as UserProfile;
        hadProfile.current = true;
        setProfile(p);
        // Keep the photo in sync with Google. The NAME is whatever the student typed at
        // sign-up (or later on their profile), so it is never overwritten from Google.
        if (!snap.metadata.fromCache && user.photoURL && p.photoURL !== user.photoURL) {
          updateOwnProfile(user.uid, { photoURL: user.photoURL });
        }
      },
      (e) => setProfileError(e),
    );
  }, [user]);

  const active = profile?.status === 'active';
  const limited = active && profile?.role === 'assistant';
  const isAdmin = active && (profile?.role === 'admin' || limited);

  useEffect(() => {
    if (!active) {
      setRawSettings(null);
      setSettingsLoaded(false);
      return;
    }
    return onSnapshot(
      settingsRef(),
      (snap) => {
        setRawSettings(snap.exists() ? (snap.data() as AppSettings) : null);
        setSettingsLoaded(true);
      },
      () => setSettingsLoaded(true),
    );
  }, [active]);

  const settings = useMemo(() => normalizeSettings(rawSettings), [rawSettings]);

  // Admin keeps the UTC offset used by the security rules up to date (DST).
  useEffect(() => {
    if (isAdmin && rawSettings) refreshOffsetIfNeeded(rawSettings);
  }, [isAdmin, rawSettings]);

  // Re-render at local midnight / periodically so "today" rolls over.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const today = todayIn(settings.timezone, new Date(now));

  const value: Session = {
    user,
    profile,
    profileError,
    removed,
    dismissRemoved: () => setRemoved(false),
    settings,
    settingsLoaded,
    today,
    isAdmin,
    limited,
    actor: user ? { uid: user.uid, name: profile?.name ?? user.displayName ?? user.email ?? 'Admin' } : null,
    async signIn() {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider);
        } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          throw e;
        }
      }
    },
    async signInWithPassword(email, password) {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code ?? '';
        if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
          throw new Error('Wrong email or password.');
        }
        if (code === 'auth/operation-not-allowed') throw new Error('Email & password sign-in is not enabled for this app yet.');
        if (code === 'auth/too-many-requests') throw new Error('Too many attempts. Wait a few minutes and try again.');
        throw e;
      }
    },
    hasPassword: !!user?.providerData.some((p) => p.providerId === 'password'),
    async setPassword(password) {
      const u = auth.currentUser;
      if (!u?.email) throw new Error('This account has no email address.');
      const run = () =>
        u.providerData.some((p) => p.providerId === 'password')
          ? updatePassword(u, password)
          : linkWithCredential(u, EmailAuthProvider.credential(u.email!, password));
      try {
        await run();
      } catch (e: unknown) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/requires-recent-login') {
          await reauthenticateWithPopup(u, googleProvider);
          await run();
        } else if (code === 'auth/operation-not-allowed') {
          throw new Error('Turn on Email/Password in Firebase → Authentication → Sign-in method first.');
        } else if (code === 'auth/weak-password') {
          throw new Error('Password must be at least 6 characters.');
        } else throw e;
      }
      await u.reload();
      setUser(auth.currentUser);
    },
    async removePassword() {
      const u = auth.currentUser;
      if (!u) return;
      if (!u.providerData.some((p) => p.providerId !== 'password')) throw new Error('This account can only sign in with a password, so it cannot be removed.');
      await unlink(u, 'password');
      await u.reload();
      setUser(auth.currentUser);
    },
    async signOut() {
      // Clear this account's offline copy from the device, then start the app fresh.
      await wipeDeviceData();
      if (user) clearUnsynced(user.uid);
      await fbSignOut(auth).catch(() => undefined);
      window.location.assign(import.meta.env.BASE_URL);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** For pages that only render once signed in and active. */
export function useActiveSession() {
  const s = useSession();
  if (!s.user || !s.profile || !s.actor) throw new Error('not signed in');
  return { ...s, user: s.user, profile: s.profile, actor: s.actor };
}
