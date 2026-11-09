import type { ReactNode } from 'react';
import { pct } from '../lib/scoring';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-sm text-slate-500" role="status">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border border-slate-300 border-t-brand-700" />
      {label}
    </div>
  );
}

export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">{children}</div>
    </div>
  );
}

export function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="num ml-1 inline-flex h-[18px] font-sans align-middle min-w-[18px] items-center justify-center rounded-full bg-brand-700 px-1 text-[11px] font-semibold text-sand-100">
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Small completion ring, used where space is tight. */
export function ProgressRing({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${pct(v)} complete`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-300/70" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="fill-none stroke-brand-700 transition-[stroke-dashoffset] duration-700 ease-calm"
        />
      </svg>
      <span className="num absolute text-[13px] text-slate-900" aria-hidden>
        {label ?? pct(v)}
      </span>
    </div>
  );
}

/**
 * The signature detail: one segment per mamool, filled as each is done.
 * Reads like ticks in a register rather than a generic percentage bar.
 */
export function SegmentBar({ fractions, className = '' }: { fractions: number[]; className?: string }) {
  if (!fractions.length) return null;
  return (
    <div className={`flex gap-1 ${className}`} aria-hidden>
      {fractions.map((f, i) => (
        <span key={i} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-slate-300/60">
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${f >= 1 ? 'bg-brand-700' : 'bg-amber-500'} transition-[width] duration-700 ease-calm`}
            style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%` }}
          />
        </span>
      ))}
    </div>
  );
}

/** A row of figures divided by hairlines — one surface, not a grid of cards. */
export function StatRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex divide-x divide-slate-200 border-y border-slate-200 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-3 py-4 first:pl-0">
      <div className="truncate text-xs text-slate-500">{label}</div>
      <div className="num mt-1 text-[26px] leading-tight font-light tracking-[-0.01em] text-slate-900">{value}</div>
      {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Kept for existing call sites; renders as a single flat figure. */
export function StatCard({ label, value, sub }: { icon?: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface">
      <Stat label={label} value={value} sub={sub} />
    </div>
  );
}

/** Colour scale for completion cells. */
export function cellClass(f: number | null | undefined): string {
  if (f == null) return 'bg-slate-100 text-slate-500';
  if (f >= 1) return 'bg-primary text-on-primary';
  if (f >= 0.75) return 'bg-brand-200 text-brand-900';
  if (f >= 0.5) return 'bg-brand-100 text-brand-900';
  if (f > 0) return 'bg-amber-100 text-amber-900';
  return 'bg-red-50 text-red-800';
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="border-y border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}

/** Inline notice. Tone: neutral (paper), info (green), warn (amber), teacher (gold). */
export function Notice({
  tone = 'neutral',
  icon,
  children,
  action,
}: {
  tone?: 'neutral' | 'info' | 'warn' | 'teacher';
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const cls = {
    neutral: 'bg-surface text-slate-700',
    info: 'bg-brand-50 text-brand-900',
    warn: 'bg-amber-50 text-amber-900',
    teacher: 'bg-gold-50 text-gold-900',
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed ${cls}`}>
      {icon && <span className="mt-px shrink-0 opacity-80">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
