import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
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
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7 rounded-[8px] shadow-[0_1px_2px_rgb(16_34_79/0.3)]" />
      <span className="text-[18px] font-semibold tracking-[-0.02em] text-brand-900">Mamūlāt</span>
    </span>
  );
}

export function Layout({ title, nav, children, right }: { title?: string; nav: NavItem[]; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="no-print pt-safe sticky top-0 z-20 border-b border-slate-200/70 bg-sand-100/85 backdrop-blur-xl backdrop-saturate-150">
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
      <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-surface/85 backdrop-blur-xl backdrop-saturate-150">
        <ul className="mx-auto flex max-w-3xl justify-around px-1">
          {nav.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand-800' : 'text-slate-500 hover:text-slate-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative flex h-8 w-14 items-center justify-center leading-none">
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill"
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-brand-100"
                          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                        />
                      )}
                      <span className="relative">
                        {isActive && isValidElement(n.icon) ? cloneElement(n.icon as ReactElement<{ weight?: string }>, { weight: 'fill' }) : n.icon}
                      </span>
                      {!!n.badge && (
                        <span className="absolute -top-1 right-1">
                          <Badge n={n.badge} />
                          <span className="sr-only"> new</span>
                        </span>
                      )}
                    </span>
                    <span>{n.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
