import type { ReactNode } from 'react';
import { pct } from '../lib/scoring';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">{children}</div>;
}

export function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function ProgressRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="7" className="fill-none stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="fill-none stroke-brand-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-bold">{label ?? pct(v)}</span>
    </div>
  );
}

export function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-0.5 p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase">
        <span aria-hidden className="mr-1">
          {icon}
        </span>
        {label}
      </div>
      <div className="text-2xl font-extrabold text-brand-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Colour scale for completion cells. */
export function cellClass(f: number | null | undefined): string {
  if (f == null) return 'bg-slate-50 text-slate-300';
  if (f >= 1) return 'bg-brand-500 text-white';
  if (f >= 0.75) return 'bg-brand-300 text-brand-900';
  if (f >= 0.5) return 'bg-brand-100 text-brand-900';
  if (f > 0) return 'bg-amber-100 text-amber-900';
  return 'bg-red-50 text-red-700';
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-slate-500">{children}</div>;
}
