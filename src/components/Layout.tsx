import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';
import { Badge } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  end?: boolean;
}

export function Layout({ title, nav, children, right }: { title: string; nav: NavItem[]; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="pt-safe sticky top-0 z-20 bg-brand-700 text-white shadow">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {right}
            <SyncIndicator />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {nav.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-2 text-xs font-semibold ${
                    isActive ? 'text-brand-700' : 'text-slate-500'
                  }`
                }
              >
                <span className="relative text-xl leading-none" aria-hidden>
                  {n.icon}
                  {!!n.badge && (
                    <span className="absolute -top-1 -right-3">
                      <Badge n={n.badge} />
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
