import { useId, useState, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/cn';
import { adminSaveEntry, restoreEntries, saveEntries, saveEntry, type Actor } from '../lib/db';
import type { DayLog, EntryStatus, LogEntry, Mamool } from '../types';
import { entryFraction } from '../lib/scoring';
import { IconCheck, IconHalf, IconX } from './icons';
import { useUndo } from './Undo';

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function targetLabel(m: Pick<Mamool, 'target' | 'unit'>) {
  return `${fmt(m.target)}${m.unit ? ` ${m.unit}` : ''}`;
}

function statusText(e: LogEntry | undefined, m: Pick<Mamool, 'target' | 'unit'>) {
  if (!e) return 'not logged';
  if (e.status === 'done') return 'done';
  if (e.status === 'missed') return 'missed';
  return `${fmt(e.amount)} of ${targetLabel(m)}`;
}

/** Counted mamoolaat (e.g. 100 tasbeeh) get a +1 tap counter. */
const isCounted = (m: Pick<Mamool, 'target'>) => m.target > 1;

const STATUS: Record<EntryStatus, { label: string; icon: ReactNode }> = {
  done: { label: 'Done', icon: <IconCheck size={18} /> },
  partial: { label: 'Partly', icon: <IconHalf size={16} /> },
  missed: { label: 'Missed', icon: <IconX size={16} /> },
};

/** Status buttons as cva variants (the shadcn/ui pattern): which status × whether it's chosen × row layout. */
const statusButton = cva(
  'relative inline-flex items-center justify-center overflow-hidden border transition-[background-color,border-color,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      status: { done: 'font-semibold', partial: 'font-medium', missed: 'font-medium' },
      on: { true: '', false: 'bg-surface' },
      layout: {
        full: 'min-h-11 rounded-md',
        compact: 'h-12 w-12 gap-1.5 rounded-[14px] sm:w-auto sm:min-w-24 sm:px-3',
        /** The main "Done" control on a full row: a round bead you press. */
        bead: 'h-14 w-14 shrink-0 rounded-full border-2',
        /** Secondary statuses on a full row. */
        chip: 'min-h-11 gap-1.5 rounded-full px-3.5 text-[13px]',
      },
    },
    compoundVariants: [
      { status: 'done', on: false, class: 'border-brand-300 text-brand-800 hover:border-brand-500 hover:bg-brand-50' },
      { status: ['partial', 'missed'], on: false, class: 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50' },
      {
        status: 'done',
        on: true,
        class: 'border-primary-strong bg-primary text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_2px_6px_-2px_rgb(29_61_150/0.5)]',
      },
      { status: 'partial', on: true, class: 'border-amber-300 bg-amber-100 text-amber-900' },
      { status: 'missed', on: true, class: 'border-red-200 bg-red-50 text-red-800' },
      { status: 'done', layout: 'full', class: 'gap-1.5 text-[15px]' },
      { status: 'done', layout: 'bead', on: false, class: 'border-brand-300 bg-surface text-brand-500 hover:border-brand-500 hover:text-brand-700' },
      {
        status: 'done',
        layout: 'bead',
        on: true,
        class:
          'border-primary-strong bg-[radial-gradient(circle_at_32%_26%,rgb(255_255_255/0.45),transparent_44%),linear-gradient(160deg,var(--color-brand-500),var(--color-primary-strong))] text-white shadow-[0_6px_16px_-6px_rgb(29_61_150/0.7)]',
      },
      { status: ['partial', 'missed'], layout: 'full', class: 'gap-1 text-xs' },
    ],
  },
);

function StatusButton({
  s,
  on,
  layout,
  disabled,
  onClick,
  icon,
  label,
  iconOnlyOnPhone,
}: {
  s: EntryStatus;
  on: boolean;
  layout: 'full' | 'compact' | 'bead' | 'chip';
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  iconOnlyOnPhone?: boolean;
}) {
  const iconOnly = layout === 'bead';
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      aria-label={iconOnlyOnPhone || iconOnly ? label : undefined}
      title={iconOnlyOnPhone || iconOnly ? label : undefined}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={statusButton({ status: s, on, layout })}
    >
      {/* the chosen state washes in from the tap, like glaze spreading */}
      <AnimatePresence initial={false}>
        {on && s === 'done' && layout !== 'bead' && (
          <motion.span
            key="wash"
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgb(255_255_255/0.22),transparent_60%)]"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <motion.span
        key={String(on)}
        className="relative inline-flex"
        initial={on ? { scale: 0.4, rotate: s === 'done' ? -25 : 0 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        {icon}
      </motion.span>
      {!iconOnly && (
        <span className={cn('relative', iconOnlyOnPhone && 'hidden text-sm sm:inline')} aria-hidden={iconOnlyOnPhone || undefined}>
          {label}
        </span>
      )}
    </motion.button>
  );
}

/** Bigger icons for the one-line rows, where the icon alone carries the meaning on a phone. */
const COMPACT_ICON: Record<EntryStatus, ReactNode> = {
  done: <IconCheck size={24} />,
  partial: <IconHalf size={22} />,
  missed: <IconX size={22} />,
};

/** Left-edge mark showing the row's state at a glance. */
function edge(status: EntryStatus | undefined) {
  if (status === 'done') return 'before:bg-primary bg-brand-50/40';
  if (status === 'partial') return 'before:bg-amber-500';
  if (status === 'missed') return 'before:bg-red-400';
  return 'before:bg-transparent';
}

function MamoolRow({
  m,
  entry,
  editable,
  showPercent,
  compact,
  onChange,
}: {
  m: Mamool;
  entry: LogEntry | undefined;
  editable: boolean;
  showPercent: boolean;
  compact?: boolean;
  onChange: (e: LogEntry | null) => void;
}) {
  const undo = useUndo();
  const amountId = useId();
  const [editingPartial, setEditingPartial] = useState(false);
  const [amount, setAmount] = useState<string>(entry?.status === 'partial' ? String(entry.amount) : '');
  const status = entry?.status;
  const f = entryFraction(entry);

  const set = (s: EntryStatus) => {
    if (!editable) return;
    if (s === 'partial') {
      setEditingPartial(true);
      setAmount(entry?.status === 'partial' ? String(entry.amount) : fmt(Math.max(1, Math.round(m.target / 2))));
      return;
    }
    setEditingPartial(false);
    if (status === s) {
      // tap again to clear (with Undo, since a mis-tap is easy on a phone)
      const prev = entry;
      onChange(null);
      if (prev) undo.undoable(`Cleared “${m.name}”`, () => onChange(prev));
    } else onChange({ status: s, amount: s === 'done' ? m.target : 0, target: m.target });
  };

  /** +1 on a counted mamool: becomes "done" when it reaches the target. */
  const bump = () => {
    if (!editable) return;
    const current = entry ? (entry.status === 'done' ? m.target : entry.amount) : 0;
    const next = Math.min(m.target, current + 1);
    setEditingPartial(false);
    if (next >= m.target) onChange({ status: 'done', amount: m.target, target: m.target });
    else onChange({ status: 'partial', amount: next, target: m.target });
  };

  const savePartial = () => {
    const a = Math.max(0, Number(amount) || 0);
    setEditingPartial(false);
    if (a >= m.target) onChange({ status: 'done', amount: m.target, target: m.target });
    else if (a <= 0) onChange({ status: 'missed', amount: 0, target: m.target });
    else onChange({ status: 'partial', amount: a, target: m.target });
  };

  if (compact) {
    return (
      <li className={`relative px-3 py-2.5 before:absolute before:inset-y-2.5 sm:px-4 before:left-0 before:w-[3px] before:rounded-r-full before:transition-colors ${edge(status)}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[15px] leading-snug font-medium break-words text-slate-900 sm:text-base" dir="auto" title={m.name}>
              {m.name}
            </div>
            <div className="num mt-0.5 truncate text-xs text-slate-500 sm:text-sm" dir="auto">
              {status === 'partial' && entry ? (
                <>
                  <span className="font-medium text-amber-800">{fmt(entry.amount)}</span> of {targetLabel(m)}
                </>
              ) : (
                targetLabel(m)
              )}
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {m.name}: {statusText(entry, m)}
          </span>
          <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`${m.name} status`}>
            {(Object.keys(STATUS) as EntryStatus[]).map((s) => (
              <StatusButton
                key={s}
                s={s}
                on={status === s}
                layout="compact"
                disabled={!editable}
                onClick={() => set(s)}
                icon={COMPACT_ICON[s]}
                label={STATUS[s].label}
                iconOnlyOnPhone
              />
            ))}
          </div>
        </div>
      {editingPartial && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl"
            aria-label={`Less ${m.name}`}
            onClick={() => setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))}
          >
            −
          </button>
          <input
            id={amountId}
            className="input num text-center text-lg"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Amount of ${m.name}`}
            autoFocus
          />
          <button type="button" className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl" aria-label={`More ${m.name}`} onClick={() => setAmount(String((Number(amount) || 0) + 1))}>
            +
          </button>
          <button type="button" className="btn-primary shrink-0" onClick={savePartial}>
            Save
          </button>
        </div>
      )}
      </li>
    );
  }

  return (
    <li className={`relative px-4 py-3.5 transition-colors before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full before:transition-colors ${edge(status)}`}>
      <span className="sr-only" aria-live="polite">
        {m.name}: {statusText(entry, m)}
      </span>
      <div className="flex items-center gap-3" role="group" aria-label={`${m.name} status`}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] leading-snug font-medium break-words text-slate-900" dir="auto">
            {m.name}
          </div>
          <div className="num mt-0.5 text-sm text-slate-500" dir="auto">
            {status === 'partial' && entry ? (
              <>
                <span className="font-medium text-amber-800">{fmt(entry.amount)}</span> of {targetLabel(m)}
              </>
            ) : status === 'done' ? (
              <span className="font-medium text-brand-700">Done · {targetLabel(m)}</span>
            ) : (
              targetLabel(m)
            )}
            {showPercent && entry && <span className="ml-2 font-medium">· {Math.round(f * 100)}%</span>}
          </div>
          <AnimatePresence initial={false}>
          {status !== 'done' && (
          <motion.div
            key="chips"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
          <div className="flex flex-wrap items-center gap-2 pt-2.5">
            {(['partial', 'missed'] as EntryStatus[]).map((s) => (
              <StatusButton key={s} s={s} on={status === s} layout="chip" disabled={!editable} onClick={() => set(s)} icon={STATUS[s].icon} label={STATUS[s].label} />
            ))}
            {editable && isCounted(m) && (
              <motion.button
                type="button"
                onClick={bump}
                whileTap={{ scale: 0.9 }}
                className="num inline-flex min-h-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-3.5 text-[13px] font-semibold text-brand-800 hover:border-brand-500"
                aria-label={`Add 1 to ${m.name} (now ${entry ? fmt(entry.status === 'done' ? m.target : entry.amount) : 0} of ${targetLabel(m)})`}
              >
                +1
              </motion.button>
            )}
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
        <StatusButton s="done" on={status === 'done'} layout="bead" disabled={!editable} onClick={() => set('done')} icon={<IconCheck size={26} />} label="Done" />
      </div>
      {editingPartial && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl"
            aria-label={`Less ${m.name}`}
            onClick={() => setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))}
          >
            −
          </button>
          <input
            id={amountId}
            className="input num text-center text-lg"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Amount of ${m.name}`}
            autoFocus
          />
          <button type="button" className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl" aria-label={`More ${m.name}`} onClick={() => setAmount(String((Number(amount) || 0) + 1))}>
            +
          </button>
          <button type="button" className="btn-primary shrink-0" onClick={savePartial}>
            Save
          </button>
        </div>
      )}
    </li>
  );
}

export function Checklist({
  uid,
  day,
  mamoolaat,
  log,
  editable,
  asAdmin,
  self,
  compact,
}: {
  uid: string;
  day: string;
  mamoolaat: Mamool[];
  log: DayLog | undefined;
  editable: boolean;
  /** When the admin edits a student's day: the edit is stamped and audited. */
  asAdmin?: Actor;
  /** When the admin logs their OWN mamool (stamped as themselves, not audited). */
  self?: Actor;
  /** One line per mamool: name on the left, status buttons on the right. */
  compact?: boolean;
}) {
  const undo = useUndo();
  const remaining = mamoolaat.filter((m) => !log?.entries?.[m.id]);
  const markRest = () => {
    const prev: Record<string, LogEntry | undefined> = {};
    const next: Record<string, LogEntry> = {};
    for (const m of remaining) {
      prev[m.id] = undefined;
      next[m.id] = { status: 'done', amount: m.target, target: m.target };
    }
    saveEntries(uid, day, next, self);
    undo.undoable(`Marked ${remaining.length} done`, () => restoreEntries(uid, day, prev, self));
  };
  return (
    <div className="flex flex-col gap-2">
      {editable && !asAdmin && remaining.length > 0 && (
        <button
          type="button"
          onClick={markRest}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-full border border-brand-200 bg-surface px-4 text-sm font-medium text-brand-800 shadow-[0_1px_2px_rgb(16_34_79/0.06)] transition-[background-color,border-color,transform] hover:border-brand-500 hover:bg-brand-50 active:scale-95"
        >
          <IconCheck size={16} />
          {remaining.length === mamoolaat.length ? 'Mark all done' : `Mark the other ${remaining.length} done`}
        </button>
      )}
      <ul className="sheet" aria-label="Checklist">
        {mamoolaat.map((m) => (
          <MamoolRow
            key={m.id + day}
            m={m}
            entry={log?.entries?.[m.id]}
            editable={editable}
            showPercent={!!asAdmin}
            compact={compact}
            onChange={(e) => (asAdmin ? adminSaveEntry(uid, day, m, e, asAdmin) : saveEntry(uid, day, m.id, e, self))}
          />
        ))}
      </ul>
    </div>
  );
}
