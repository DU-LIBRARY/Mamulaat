import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './hooks/useSession';
import { useAllUsers } from './hooks/useAdminData';
import { AdminLayout } from './components/AdminLayout';
import { Toast } from './components/Toast';
import { NotificationSetup } from './components/NotificationSetup';
import { refreshToken, onForegroundMessage } from './lib/messaging';
import { updateOwnProfile } from './lib/db';
import { Overview } from './pages/admin/Overview';
import { MyMamool } from './pages/admin/MyMamool';
import { Classes } from './pages/admin/Classes';
import { ClassView } from './pages/admin/ClassView';
import { Students } from './pages/admin/Students';
import { StudentDetail } from './pages/admin/StudentDetail';
import { AdminSettings } from './pages/admin/Settings';
import { Audit } from './pages/admin/Audit';
import { Remind } from './pages/admin/Remind';

/** The teacher's side of the app, split into its own chunk (loaded lazily from App). */
export default function AdminRoutes() {
  const { profile, limited } = useSession();
  const users = useAllUsers();
  const [toast, setToast] = useState<string | null>(null);
  const pending = users.data.filter((u) => u.status === 'pending').length;
  const uid = profile!.id;
  useEffect(() => {
    // Per device: keeps this device's subscription alive if it has notifications on, and marks the
    // account as reachable if an older version of the app had switched it off from another device.
    refreshToken(uid).then((ok) => {
      if (ok && !profile?.reminderEnabled) updateOwnProfile(uid, { reminderEnabled: true });
    });
    let unsub: (() => void) | undefined;
    onForegroundMessage((t, b) => setToast(`${t}: ${b}`)).then((u) => (unsub = u));
    return () => unsub?.();
  }, [uid]); // once per sign-in
  return (
    <NotificationSetup profile={profile!} purpose="You’ll get a notification on this device when a new student signs up and is waiting for approval.">
      <AdminLayout pending={pending} limited={limited}>
        {toast && <Toast text={toast} onClose={() => setToast(null)} />}
        <Routes>
          {!limited && <Route path="/admin" element={<MyMamool />} />}
          {!limited && <Route path="/admin/overview" element={<Overview />} />}
          <Route path="/admin/classes" element={<Classes />} />
          <Route path="/admin/class/:classId" element={<ClassView />} />
          <Route path="/admin/students" element={<Students />} />
          <Route path="/admin/student/:uid" element={<StudentDetail />} />
          {limited && <Route path="/admin/remind" element={<Remind />} />}
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to={limited ? '/admin/students' : '/admin'} replace />} />
        </Routes>
      </AdminLayout>
    </NotificationSetup>
  );
}
