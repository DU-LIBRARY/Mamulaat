import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { fade, glide, snap } from '../lib/motion';
import { SyncIndicator } from './SyncIndicator';
import { Badge } from './ui';
import { Sky } from './Sky';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
  /** Other paths (and everything under them) that also count as this tab. */
  also?: string[];
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-6 w-6 rounded-[5px]" />
      <span className="font-serif text-[22px] leading-none text-slate-900">Mamūlāt</span>
    </span>
  );
}

export function Layout({ title, nav, children, right }: { title?: string; nav: NavItem[]; children: ReactNode; right?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="relative isolate">
      <Sky />
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
        <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        {/*
          The header scrolls away with the page rather than sticking. Safari treats a bar pinned
          to the top as a toolbar and paints the status bar strip solid; without one, content
          slides up under the clock and Dynamic Island the way native apps and Safari's own pages do.
        */}
        <header className="no-print pt-safe relative z-20">
          <div className="flex h-14 items-center justify-between gap-2 px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Wordmark />
              {title && <span className="text-sm text-slate-500">{title}</span>}
              <SyncIndicator />
            </div>
            {right && <div className="flex items-center gap-2">{right}</div>}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-5 pt-4 pb-28 focus:outline-none">
          {/* each screen settles in: a short rise and fade on the shared easing curve */}
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ y: glide, opacity: fade }}>
            {children}
          </motion.div>
        </main>
        <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-sand-100/90 backdrop-blur-lg">
          <ul className="mx-auto flex max-w-3xl justify-around">
            {nav.map((n) => {
              const alsoActive = !!n.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
              return (
              <li key={n.to} className="flex-1">
                <NavLink
                  to={n.to}
                  end={n.end}
                  aria-current={alsoActive ? 'page' : undefined}
                  className={({ isActive: routeActive }) => {
                    const isActive = routeActive || alsoActive;
                    return (
                    `relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-2 text-[11px] transition-colors duration-200 ${
                      isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                    }`
                    );
                  }}
                >
                  {({ isActive: routeActive }) => {
                    const isActive = routeActive || alsoActive;
                    return (
                    <>
                      <span className="relative leading-none">
                        {isActive && isValidElement(n.icon) ? cloneElement(n.icon as ReactElement<{ weight?: string }>, { weight: 'regular' }) : n.icon}
                        {!!n.badge && (
                          <span className="absolute -top-1.5 -right-3">
                            <Badge n={n.badge} />
                            <span className="sr-only"> new</span>
                          </span>
                        )}
                      </span>
                      <span>{n.label}</span>
                      {/* a short clay rule under the active tab; it slides across when the tab changes */}
                      <span aria-hidden className="relative h-px w-4">
                        {isActive && <motion.span layoutId="tab-rule" className="absolute inset-0 bg-brand-700" transition={snap} />}
                      </span>
                    </>
                    );
                  }}
                </NavLink>
              </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
