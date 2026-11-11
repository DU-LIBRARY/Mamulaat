import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';
import { IconClasses, IconOverview, IconPeople, IconSettings, IconToday } from './icons';

export function AdminLayout({ children, pending }: { children: ReactNode; pending: number }) {
  return (
    <Layout
      title="Admin"
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
