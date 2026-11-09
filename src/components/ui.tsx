import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { pct } from '../lib/scoring';
import { cn } from '../lib/cn';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-sm text-slate-500" role="status">
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-brand-500"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </span>
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
    <span className="num ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-semibold text-white ring-2 ring-surface">
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Small completion ring, used where space is tight. */
export function ProgressRing({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${pct(v)} complete`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-500 [stroke-linecap:round]"
        />
      </svg>
      <span className="num absolute text-[13px] font-semibold text-slate-800" aria-hidden>
        {label ?? pct(v)}
      </span>
    </div>
  );
}

/** The khatam: the eight-pointed star of the tilework, drawn from two overlapping squares. */
export function Khatam({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="1.2" />
      <rect x="5" y="5" width="14" height="14" rx="1.2" transform="rotate(45 12 12)" />
    </svg>
  );
}

/** A girih field of eight-pointed stars, drawn faintly into the cobalt tile. */
export function Girih({ className = '' }: { className?: string }) {
  return (
    <svg className={cn('pointer-events-none absolute inset-0 -z-10 h-full w-full', className)} aria-hidden>
      <defs>
        <pattern id="girih" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="12" y="12" width="20" height="20" />
            <rect x="12" y="12" width="20" height="20" transform="rotate(45 22 22)" />
            <path d="M0 22h7.9M36.1 22H44M22 0v7.9M22 36.1V44" />
            <rect x="-6" y="-6" width="12" height="12" transform="rotate(45 0 0)" />
            <rect x="38" y="-6" width="12" height="12" transform="rotate(45 44 0)" />
            <rect x="-6" y="38" width="12" height="12" transform="rotate(45 0 44)" />
            <rect x="38" y="38" width="12" height="12" transform="rotate(45 44 44)" />
          </g>
        </pattern>
        <linearGradient id="girih-fade" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="girih-mask">
          <rect width="100%" height="100%" fill="url(#girih-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#girih)" mask="url(#girih-mask)" />
    </svg>
  );
}

/**
 * The signature detail: today's mamoolaat as a tasbeeh strand. One bead per mamool on a
 * thread; a bead fills with saffron as it's partly done and turns to cobalt glaze when done.
 * When every bead is done, the khatam at the end of the strand lights up in turquoise.
 */
export function SegmentBar({ fractions, className = '', onTile = false }: { fractions: number[]; className?: string; onTile?: boolean }) {
  if (!fractions.length) return null;
  const complete = fractions.every((f) => f >= 1);
  // On the cobalt tile the beads are gold; on paper they are cobalt.
  const t = onTile
    ? {
        thread: 'bg-white/30',
        done: 'border-gold-400',
        part: 'border-gold-400 bg-white/10',
        empty: 'border-white/45 bg-white/10',
        fill: 'bg-gold-400/80',
        glaze: 'bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.7),transparent_45%),linear-gradient(160deg,#f1d27f,#b3861f)]',
        star: 'stroke-white/45',
      }
    : {
        thread: 'bg-slate-300',
        done: 'border-primary-strong',
        part: 'border-amber-500 bg-surface',
        empty: 'border-slate-300 bg-surface',
        fill: 'bg-amber-300',
        glaze: 'bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.55),transparent_42%),linear-gradient(160deg,var(--color-brand-500),var(--color-primary-strong))]',
        star: 'stroke-slate-300',
      };
  return (
    <div className={cn('flex items-center gap-2', className)} aria-hidden>
      <div className="relative flex flex-1 items-center justify-between">
        <span className={cn('absolute inset-x-1 top-1/2 h-px -translate-y-1/2', t.thread)} />
        {fractions.map((raw, i) => {
          const f = Math.max(0, Math.min(1, raw));
          const done = f >= 1;
          return (
            <motion.span
              key={i}
              className={cn(
                'relative aspect-square min-w-[10px] shrink-0 overflow-hidden rounded-full border',
                done ? t.done : f > 0 ? t.part : t.empty,
              )}
              style={{ width: `min(22px, calc((100% - ${(fractions.length - 1) * 6}px) / ${fractions.length}))` }}
              animate={done ? { scale: [1, 1.28, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* saffron fill rising inside the bead */}
              <motion.span
                className={cn('absolute inset-x-0 bottom-0', t.fill)}
                initial={false}
                animate={{ height: `${done ? 0 : f * 100}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              />
              {/* cobalt glaze, with a highlight like light on a polished bead */}
              <motion.span
                className={cn('absolute inset-0 rounded-full', t.glaze)}
                initial={false}
                animate={{ opacity: done ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </motion.span>
          );
        })}
      </div>
      <span className="relative h-6 w-6 shrink-0">
        <Khatam className={cn('absolute inset-0 fill-none [stroke-width:1.4]', t.star)} />
        <AnimatePresence>
          {complete && (
            <motion.span
              key="lit"
              className="absolute inset-0"
              initial={{ scale: 0.3, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.25 }}
            >
              <Khatam className="h-full w-full fill-turq-400 stroke-turq-600 [stroke-width:1]" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

/** A row of figures divided by hairlines — one surface, not a grid of cards. */
export function StatRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex divide-x divide-slate-200/80 rounded-xl border border-slate-200/80 bg-surface shadow-glaze', className)}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-3.5 py-3.5">
      <div className="truncate text-xs text-slate-500">{label}</div>
      <div className="num mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">{value}</div>
      {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Kept for existing call sites; renders as a single flat figure. */
export function StatCard({ label, value, sub }: { icon?: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-surface shadow-glaze">
      <Stat label={label} value={value} sub={sub} />
    </div>
  );
}

/** Colour scale for completion cells. */
export function cellClass(f: number | null | undefined): string {
  if (f == null) return 'bg-slate-100 text-slate-500';
  if (f >= 1) return 'bg-primary text-white';
  if (f >= 0.75) return 'bg-brand-300 text-brand-900';
  if (f >= 0.5) return 'bg-brand-100 text-brand-900';
  if (f > 0) return 'bg-amber-100 text-amber-900';
  return 'bg-red-50 text-red-800';
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
      <Khatam className="h-6 w-6 fill-brand-50 stroke-brand-300 [stroke-width:1.2]" />
      <div>{children}</div>
    </div>
  );
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
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    info: 'border-brand-100 bg-brand-50 text-brand-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    teacher: 'border-gold-400/50 bg-gold-50 text-gold-900',
  }[tone];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', cls)}>
      {icon && <span className="mt-px shrink-0 opacity-80">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
