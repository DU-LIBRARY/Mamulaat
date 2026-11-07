import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';
import { useSession } from '../hooks/useSession';

export function AdminLayout({ children, pending }: { children: ReactNode; pending: number }) {
  const { signOut } = useSession();
  return (
    <Layout
      title="Mamulaat Admin"
      right={
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-white/40 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
        >
          Sign out
        </button>
      }
      nav={[
        { to: '/admin', label: 'Overview', icon: '📊', end: true },
        { to: '/admin/classes', label: 'Classes', icon: '🏫' },
        { to: '/admin/students', label: 'Students', icon: '👥', badge: pending },
        { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
      ]}
    >
      <StaleDataNotice />
      {children}
    </Layout>
  );
}
