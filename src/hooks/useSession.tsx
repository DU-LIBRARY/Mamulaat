import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, googleProvider } from '../firebase';
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
  isAdmin: boolean;
  signIn: () => Promise<void>;
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
    let creating = false;
    return onSnapshot(
      userRef(user.uid),
      (snap) => {
        setProfileError(null);
        if (!snap.exists()) {
          if (snap.metadata.fromCache) return; // wait for the server before deciding it's new
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
        setProfile(p);
        // keep name/photo in sync with Google (only fields Google sign-in provides)
        if (!snap.metadata.fromCache && (p.name !== user.displayName || p.photoURL !== user.photoURL) && user.displayName) {
          updateOwnProfile(user.uid, { name: user.displayName, photoURL: user.photoURL ?? null });
        }
      },
      (e) => setProfileError(e),
    );
  }, [user]);

  const active = profile?.status === 'active';
  const isAdmin = active && profile?.role === 'admin';

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
    settings,
    settingsLoaded,
    today,
    isAdmin,
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
    async signOut() {
      await fbSignOut(auth);
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
