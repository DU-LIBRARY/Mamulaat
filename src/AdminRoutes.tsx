import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './hooks/useSession';
import { useAllUsers } from './hooks/useAdminData';
import { AdminLayout } from './components/AdminLayout';
import { Toast } from './components/Toast';
import { refreshToken, onForegroundMessage } from './lib/messaging';
import { Overview } from './pages/admin/Overview';
import { MyMamool } from './pages/admin/MyMamool';
import { Classes } from './pages/admin/Classes';
import { ClassView } from './pages/admin/ClassView';
import { Students } from './pages/admin/Students';
import { StudentDetail } from './pages/admin/StudentDetail';
import { AdminSettings } from './pages/admin/Settings';
import { Audit } from './pages/admin/Audit';

/** The teacher's side of the app, split into its own chunk (loaded lazily from App). */
export default function AdminRoutes() {
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
