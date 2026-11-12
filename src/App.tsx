import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { configMissing } from './firebase';
import { SessionProvider, useSession } from './hooks/useSession';
import { StudentDataProvider, useMyData } from './hooks/useStudentData';
import { FullScreen, Spinner } from './components/ui';
import { Splash } from './components/quiet';
import { Layout } from './components/Layout';
import { SignIn } from './pages/SignIn';
import { ConfigMissing, Waiting } from './pages/Waiting';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/student/Onboarding';
import { LogDay } from './pages/student/LogDay';
import { Week } from './pages/student/Week';
import { Salah } from './pages/student/Salah';
import { FajrRoll } from './pages/student/FajrRoll';
import { Messages } from './pages/student/Messages';
import { ManageMamoolaat } from './pages/student/ManageMamoolaat';
import { Me } from './pages/student/Me';
import { DialogProvider } from './components/Dialog';
import { UndoProvider } from './components/Undo';
import { touchLastSeen } from './lib/db';
import { UpdatePrompt } from './components/UpdatePrompt';
import { onForegroundMessage, refreshToken } from './lib/messaging';
import { IconInbox, IconLog, IconPerson, IconSalah, IconWeek } from './components/icons';
import { Toast } from './components/Toast';

// The teacher's side loads only for the teacher, so students never parse it.
const AdminRoutes = lazy(() => import('./AdminRoutes'));

function StudentRoutes() {
  const { profile } = useSession();
  const data = useMyData();
  const [toast, setToast] = useState<string | null>(null);
  const uid = profile!.id;

  useEffect(() => {
    if (profile?.reminderEnabled) refreshToken(uid);
    let unsub: (() => void) | undefined;
    onForegroundMessage((t, b) => setToast(`${t}: ${b}`)).then((u) => (unsub = u));
    return () => unsub?.();
  }, [uid, profile?.reminderEnabled]);

  // "Last seen" for the admin's Students page: at most every 30 minutes, when the app is in front.
  const lastSeenMs = profile?.lastSeenAt?.toMillis?.() ?? 0;
  useEffect(() => {
    const touch = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSeenMs > 30 * 60_000) touchLastSeen(uid);
    };
    touch();
    document.addEventListener('visibilitychange', touch);
    return () => document.removeEventListener('visibilitychange', touch);
  }, [uid, lastSeenMs]);

  if (data.loading && !data.all.length) return <Splash status="Loading your mamoolaat…" />;
  if (!profile!.onboarded) return <Onboarding />;

  return (
    <Layout
      nav={[
        { to: '/', label: 'Mamool', icon: <IconLog />, end: true, also: ['/log', '/mamoolaat'] },
        { to: '/salah', label: 'Salah', icon: <IconSalah /> },
        { to: '/week', label: 'Week', icon: <IconWeek /> },
        { to: '/messages', label: 'Inbox', icon: <IconInbox />, badge: data.unreadComments + data.unseenChanges },
        { to: '/me', label: 'Me', icon: <IconPerson /> },
      ]}
    >
      {toast && <Toast text={toast} onClose={() => setToast(null)} />}
      <Routes>
        <Route path="/" element={<LogDay />} />
        <Route path="/log" element={<Navigate to="/" replace />} />
        <Route path="/log/:day" element={<LogDay />} />
        <Route path="/salah" element={<Salah />} />
        <Route path="/salah/fajr" element={<FajrRoll />} />
        <Route path="/salah/:day" element={<Salah />} />
        <Route path="/week" element={<Week />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/mamoolaat" element={<ManageMamoolaat />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Gate() {
  const { user, profile, profileError, isAdmin, signOut, removed, dismissRemoved } = useSession();
  if (removed) {
    return (
      <FullScreen>
        <h1 className="display text-[34px] leading-tight">Your account was removed</h1>
        <p className="mt-3 max-w-sm text-slate-600">
          Your teacher removed your Mamūlāt account and its data, and you have been signed out. If you think this is a mistake, please talk to your teacher.
        </p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">If you sign in again, a new sign-up request will be sent to your teacher for approval.</p>
        <button className="btn-primary mt-6" onClick={dismissRemoved}>
          OK
        </button>
      </FullScreen>
    );
  }
  if (user === undefined) return <Splash />;
  if (user === null) return <SignIn />;
  if (profile === undefined) {
    return (
      <FullScreen>
        {profileError ? (
          <>
            <p className="mb-4 text-red-700">Could not load your account: {profileError.message}</p>
            <button className="btn-secondary" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <Spinner label={navigator.onLine ? 'Setting up your account…' : 'Waiting for connection…'} />
        )}
      </FullScreen>
    );
  }
  if (!profile) return <Spinner />;
  if (profile.status === 'pending' && !profile.signupComplete) return <Signup profile={profile} />;
  if (profile.status !== 'active') return <Waiting profile={profile} />;
  if (isAdmin)
    return (
      <Suspense fallback={<Splash />}>
        <AdminRoutes />
      </Suspense>
    );
  return (
    <StudentDataProvider uid={profile.id}>
      <StudentRoutes />
    </StudentDataProvider>
  );
}

export default function App() {
  if (configMissing) return <ConfigMissing />;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <SessionProvider>
        <DialogProvider>
          <UndoProvider>
            <UpdatePrompt />
            <Gate />
          </UndoProvider>
        </DialogProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
