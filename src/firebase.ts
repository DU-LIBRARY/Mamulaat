import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

/**
 * Configuration for the DEDICATED Mamulaat Firebase project.
 * All values come from environment variables (see .env.example / README).
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

export const configMissing = !firebaseConfig.apiKey || !firebaseConfig.projectId;

export const app = initializeApp(
  configMissing ? { apiKey: 'missing', projectId: 'missing', appId: 'missing' } : firebaseConfig,
);

// Keep students signed in on this device (IndexedDB, falling back to localStorage),
// so the app opens offline.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Offline-first: persistent IndexedDB cache shared across tabs. Reads come from
// the cache when offline; writes are queued and synced automatically.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // Local-testing helper for automated browser tests against the Auth EMULATOR only:
  // the emulator accepts unsigned fake Google ID tokens; real Firebase Auth rejects them,
  // and this code is not even included unless VITE_USE_EMULATORS=true.
  (window as unknown as Record<string, unknown>).__emulatorGoogleSignIn = async (sub: string, email: string, name: string) => {
    const { signInWithCredential } = await import('firebase/auth');
    const token = JSON.stringify({ sub, email, email_verified: true, name });
    return signInWithCredential(auth, GoogleAuthProvider.credential(token));
  };
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
