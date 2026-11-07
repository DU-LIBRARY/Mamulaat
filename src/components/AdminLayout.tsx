import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';

export function AdminLayout({ children, pending }: { children: ReactNode; pending: number }) {
  return (
    <Layout
      title="Mamulaat Admin"
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
