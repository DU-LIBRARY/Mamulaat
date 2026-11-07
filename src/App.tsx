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
import { Onboarding } from './pages/student/Onboarding';
import { Home } from './pages/student/Home';
import { LogDay } from './pages/student/LogDay';
import { Week } from './pages/student/Week';
import { Messages } from './pages/student/Messages';
import { ManageMamoolaat } from './pages/student/ManageMamoolaat';
import { Me } from './pages/student/Me';
import { Overview } from './pages/admin/Overview';
import { Classes } from './pages/admin/Classes';
import { ClassView } from './pages/admin/ClassView';
import { Students } from './pages/admin/Students';
import { StudentDetail } from './pages/admin/StudentDetail';
import { AdminSettings } from './pages/admin/Settings';
import { Audit } from './pages/admin/Audit';
import { onForegroundMessage, refreshToken } from './lib/messaging';

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-x-4 top-16 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-lg">
      <span className="flex-1">{text}</span>
      <button className="btn-ghost min-h-8 px-2 text-white" onClick={onClose} aria-label="Dismiss">
        ✕
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

  if (data.loading && !data.all.length) return <Spinner />;
  if (!profile!.onboarded) return <Onboarding />;

  return (
    <Layout
      title="Mamulaat"
      nav={[
        { to: '/', label: 'Today', icon: '🏠', end: true },
        { to: '/log', label: 'Log', icon: '📝' },
        { to: '/week', label: 'Week', icon: '📅' },
        { to: '/messages', label: 'Inbox', icon: '💬', badge: data.unreadComments + data.unseenChanges },
        { to: '/me', label: 'Me', icon: '👤' },
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
  const users = useAllUsers();
  const pending = users.data.filter((u) => u.status === 'pending').length;
  return (
    <AdminLayout pending={pending}>
      <Routes>
        <Route path="/admin" element={<Overview />} />
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
  const { user, profile, profileError, isAdmin, signOut } = useSession();
  if (user === undefined) return <Spinner label="Opening Mamulaat…" />;
  if (user === null) return <SignIn />;
  if (profile === undefined) {
    return (
      <FullScreen>
        {profileError ? (
          <>
            <p className="mb-4 text-red-600">Could not load your account: {profileError.message}</p>
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
    <BrowserRouter>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </BrowserRouter>
  );
}
