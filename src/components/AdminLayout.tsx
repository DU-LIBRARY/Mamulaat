import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Layout } from './Layout';
import { StaleDataNotice } from './SyncIndicator';
import { IconBell, IconClasses, IconOverview, IconPeople, IconSettings, IconToday } from './icons';

export function AdminLayout({ children, pending, limited = false }: { children: ReactNode; pending: number; limited?: boolean }) {
  // A limited admin has no "Mine" or Overview: both are built from mamoolaat and logs.
  const records = [
    { to: '/admin', label: 'Mine', icon: <IconToday />, end: true },
    { to: '/admin/overview', label: 'Overview', icon: <IconOverview /> },
  ];
  const students = { to: '/admin/students', label: 'Students', icon: <IconPeople />, badge: pending, also: ['/admin/student'] };
  // Classes get their own tab so class mamoolaat, the Fajr monitor and the weekend rep are one tap away.
  const classes = { to: '/admin/classes', label: 'Classes', icon: <IconClasses />, also: ['/admin/class'] };
  return (
    <Layout
      title="Admin"
      nav={limited ? [students, classes, { to: '/admin/remind', label: 'Remind', icon: <IconBell size={22} weight="light" /> }] : [...records, students, classes]}
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
