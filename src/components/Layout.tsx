import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';
import { Badge } from './ui';
import { Sky } from './Sky';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6 rounded-[5px]" />
      <span className="font-serif text-[22px] leading-none text-slate-900">Mamūlāt</span>
    </span>
  );
}

/** True once the page has scrolled, so the header only gains a backdrop when content is under it. */
function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return s;
}

export function Layout({ title, nav, children, right }: { title?: string; nav: NavItem[]; children: ReactNode; right?: ReactNode }) {
  const scrolled = useScrolled();
  return (
    <div className="relative isolate">
      <Sky />
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
        <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        <header
          className={`no-print pt-safe sticky top-0 z-20 transition-[background-color,border-color] duration-300 ease-calm ${
            scrolled ? 'border-b border-slate-200/70 bg-sand-100/85 backdrop-blur-lg' : 'border-b border-transparent'
          }`}
        >
          <div className="flex h-14 items-center justify-between gap-2 px-5">
            <div className="flex items-baseline gap-2.5">
              <Wordmark />
              {title && <span className="text-sm text-slate-500">{title}</span>}
            </div>
            <div className="flex items-center gap-2">
              {right}
              <SyncIndicator />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-5 pt-4 pb-28 focus:outline-none">
          {children}
        </main>
        <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-sand-100/90 backdrop-blur-lg">
          <ul className="mx-auto flex max-w-3xl justify-around">
            {nav.map((n) => (
              <li key={n.to} className="flex-1">
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-2 text-[11px] transition-colors duration-200 ${
                      isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                    }`
                  }
                >
                  {({ isActive }) => (
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
                      {/* a short clay rule under the active tab */}
                      <span aria-hidden className={`h-px w-4 transition-colors duration-200 ${isActive ? 'bg-brand-700' : 'bg-transparent'}`} />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
