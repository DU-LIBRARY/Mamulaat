import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';
import { IconBell, IconOverview, IconPeople, IconSettings, IconToday } from './icons';

export function AdminLayout({ children, pending, limited = false }: { children: ReactNode; pending: number; limited?: boolean }) {
  // A limited admin has no "Mine" or Overview: both are built from mamoolaat and logs.
  const records = [
    { to: '/admin', label: 'Mine', icon: <IconToday />, end: true },
    { to: '/admin/overview', label: 'Overview', icon: <IconOverview /> },
  ];
  // Classes and students are one tab: the class list leads to each class's students.
  const students = { to: '/admin/students', label: 'Students', icon: <IconPeople />, badge: pending, also: ['/admin/classes', '/admin/class', '/admin/student'] };
  return (
    <Layout
      title="Admin"
      nav={limited ? [students, { to: '/admin/remind', label: 'Remind', icon: <IconBell size={22} weight="light" /> }] : [...records, students]}
      right={
        <NavLink
          to="/admin/settings"
          className={({ isActive }) =>
            `inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
          }
        >
          <IconSettings />
          <span>Settings</span>
        </NavLink>
      }
    >
      <StaleDataNotice />
      {children}
    </Layout>
  );
}
