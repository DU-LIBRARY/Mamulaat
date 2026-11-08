import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';
import { useSession } from '../hooks/useSession';
import { IconClasses, IconOverview, IconPeople, IconSettings, IconToday } from './icons';

export function AdminLayout({ children, pending }: { children: ReactNode; pending: number }) {
  const { signOut } = useSession();
  return (
    <Layout
      title="Admin"
      right={
        <button type="button" onClick={() => signOut()} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900">
          Sign out
        </button>
      }
      nav={[
        { to: '/admin', label: 'Mine', icon: <IconToday />, end: true },
        { to: '/admin/overview', label: 'Overview', icon: <IconOverview /> },
        { to: '/admin/classes', label: 'Classes', icon: <IconClasses /> },
        { to: '/admin/students', label: 'Students', icon: <IconPeople />, badge: pending },
        { to: '/admin/settings', label: 'Settings', icon: <IconSettings /> },
      ]}
    >
      <StaleDataNotice />
      {children}
    </Layout>
  );
}
