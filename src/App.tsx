import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { configMissing } from './firebase';
import { SessionProvider, useSession } from './hooks/useSession';
import { StudentDataProvider, useMyData } from './hooks/useStudentData';
import { useAllUsers } from './hooks/useAdminData';
import { FullScreen, Spinner } from './components/ui';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { SignIn } from './pages/SignIn';
import { ConfigMissing, Waiting } from './pages/Waiting';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/student/Onboarding';
import { Home } from './pages/student/Home';
import { LogDay } from './pages/student/LogDay';
import { Week } from './pages/student/Week';
import { Messages } from './pages/student/Messages';
import { ManageMamoolaat } from './pages/student/ManageMamoolaat';
import { Me } from './pages/student/Me';
import { Overview } from './pages/admin/Overview';
import { MyMamool } from './pages/admin/MyMamool';
import { Classes } from './pages/admin/Classes';
import { ClassView } from './pages/admin/ClassView';
import { Students } from './pages/admin/Students';
import { StudentDetail } from './pages/admin/StudentDetail';
import { AdminSettings } from './pages/admin/Settings';
import { Audit } from './pages/admin/Audit';
import { DialogProvider } from './components/Dialog';
import { UndoProvider } from './components/Undo';
import { touchLastSeen } from './lib/db';
import { UpdatePrompt } from './components/UpdatePrompt';
import { onForegroundMessage, refreshToken } from './lib/messaging';
import { IconInbox, IconLog, IconPerson, IconToday, IconWeek, IconX } from './components/icons';

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="alert" className="top-safe-toast fixed inset-x-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 py-3 pr-2 pl-4 text-sm text-white shadow-lg">
      <span className="flex-1">{text}</span>
      <button className="btn min-h-9 px-2 text-white/80 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Dismiss">
        <IconX size={18} />
      </button>
    </div>
  );
}

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

  if (data.loading && !data.all.length) return <Spinner />;
  if (!profile!.onboarded) return <Onboarding />;

  return (
    <Layout
      nav={[
        { to: '/', label: 'Today', icon: <IconToday />, end: true },
        { to: '/log', label: 'Log', icon: <IconLog /> },
        { to: '/week', label: 'Week', icon: <IconWeek /> },
        { to: '/messages', label: 'Inbox', icon: <IconInbox />, badge: data.unreadComments + data.unseenChanges },
        { to: '/me', label: 'Me', icon: <IconPerson /> },
      ]}
    >
      {toast && <Toast text={toast} onClose={() => setToast(null)} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<LogDay />} />
        <Route path="/log/:day" element={<LogDay />} />
        <Route path="/week" element={<Week />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/mamoolaat" element={<ManageMamoolaat />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AdminRoutes() {
  const { profile } = useSession();
  const users = useAllUsers();
  const [toast, setToast] = useState<string | null>(null);
  const pending = users.data.filter((u) => u.status === 'pending').length;
  const uid = profile!.id;
  useEffect(() => {
    if (profile?.reminderEnabled) refreshToken(uid);
    let unsub: (() => void) | undefined;
    onForegroundMessage((t, b) => setToast(`${t}: ${b}`)).then((u) => (unsub = u));
    return () => unsub?.();
  }, [uid, profile?.reminderEnabled]);
  return (
    <AdminLayout pending={pending}>
      {toast && <Toast text={toast} onClose={() => setToast(null)} />}
      <Routes>
        <Route path="/admin" element={<MyMamool />} />
        <Route path="/admin/overview" element={<Overview />} />
        <Route path="/admin/classes" element={<Classes />} />
        <Route path="/admin/class/:classId" element={<ClassView />} />
        <Route path="/admin/students" element={<Students />} />
        <Route path="/admin/student/:uid" element={<StudentDetail />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

function Gate() {
  const { user, profile, profileError, isAdmin, signOut, removed, dismissRemoved } = useSession();
  if (removed) {
    return (
      <FullScreen>
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-slate-900">Your account was removed</h1>
        <p className="mt-3 max-w-sm text-slate-600">
          Your teacher removed your Mamulaat account and its data, and you have been signed out. If you think this is a mistake, please talk to your teacher.
        </p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">If you sign in again, a new sign-up request will be sent to your teacher for approval.</p>
        <button className="btn-primary mt-6" onClick={dismissRemoved}>
          OK
        </button>
      </FullScreen>
    );
  }
  if (user === undefined) return <Spinner label="Opening Mamulaat…" />;
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
  if (isAdmin) return <AdminRoutes />;
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
