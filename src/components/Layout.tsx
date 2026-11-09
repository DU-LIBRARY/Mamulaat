import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';
import { Badge } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6 rounded-[5px]" />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-brand-900">Mamūlāt</span>
    </span>
  );
}

export function Layout({ title, nav, children, right }: { title?: string; nav: NavItem[]; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="no-print pt-safe sticky top-0 z-20 border-b border-slate-200 bg-sand-100">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-baseline gap-2">
            <Wordmark />
            {title && <span className="text-sm text-slate-500">{title}</span>}
          </div>
          <div className="flex items-center gap-2">
            {right}
            <SyncIndicator />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 px-4 pt-5 pb-28 focus:outline-none">
        {children}
      </main>
      <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-surface">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {nav.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-2 text-[11px] font-medium ${
                    isActive ? 'text-brand-700 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-primary' : 'text-slate-500'
                  }`
                }
              >
                <span className="relative leading-none">
                  {n.icon}
                  {!!n.badge && (
                    <span className="absolute -top-1.5 -right-3">
                      <Badge n={n.badge} />
                      <span className="sr-only"> new</span>
                    </span>
                  )}
                </span>
                <span>{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
