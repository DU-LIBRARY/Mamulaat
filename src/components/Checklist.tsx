import { useId, useState, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'motion/react';
import { expand, fade, snap } from '../lib/motion';
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
  'relative inline-flex items-center justify-center transition-[background-color,border-color,color] duration-300 ease-calm disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      status: { done: '', partial: '', missed: '' },
      on: { true: '', false: '' },
      layout: {
        full: 'min-h-11 gap-1.5 rounded-md border text-[15px]',
        compact: 'h-11 w-11 gap-1.5 rounded-full border sm:w-auto sm:min-w-24 sm:px-3',
        /** The main "Done" control on a full row: a circle you tick. */
        circle: 'h-11 w-11 shrink-0 rounded-full border',
        /** Secondary statuses on a full row: quiet text buttons. */
        text: '-ml-2 min-h-11 gap-1.5 rounded-md px-2 text-[13px]',
      },
    },
    compoundVariants: [
      { status: 'done', on: false, layout: ['full', 'compact', 'circle'], class: 'border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-700' },
      { status: 'done', on: true, layout: ['full', 'compact', 'circle'], class: 'border-primary bg-primary text-on-primary' },
      { status: ['partial', 'missed'], on: false, layout: ['full', 'compact'], class: 'border-slate-200 text-slate-500 hover:border-slate-300' },
      { status: 'partial', on: true, layout: ['full', 'compact'], class: 'border-amber-200 bg-amber-50 text-amber-900' },
      { status: 'missed', on: true, layout: ['full', 'compact'], class: 'border-red-200 bg-red-50 text-red-800' },
      { status: ['partial', 'missed'], on: false, layout: 'text', class: 'text-slate-500 hover:text-slate-800' },
      { status: 'partial', on: true, layout: 'text', class: 'text-amber-800' },
      { status: 'missed', on: true, layout: 'text', class: 'text-red-800' },
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
  layout: 'full' | 'compact' | 'circle' | 'text';
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  iconOnlyOnPhone?: boolean;
}) {
  const iconOnly = layout === 'circle';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      aria-label={iconOnlyOnPhone || iconOnly ? label : undefined}
      title={iconOnlyOnPhone || iconOnly ? label : undefined}
      className={statusButton({ status: s, on, layout })}
    >
      {/* the tick draws in when chosen; nothing bounces */}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={String(on)}
          className="inline-flex"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: fade }}
          transition={snap}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
      {!iconOnly && (
        <span className={cn(iconOnlyOnPhone && 'hidden text-sm sm:inline')} aria-hidden={iconOnlyOnPhone || undefined}>
          {label}
        </span>
      )}
    </button>
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
  if (status === 'done') return 'before:bg-brand-700';
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
    <li className="relative py-4">
      <span className="sr-only" aria-live="polite">
        {m.name}: {statusText(entry, m)}
      </span>
      <div className="flex items-center gap-3" role="group" aria-label={`${m.name} status`}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] leading-snug break-words text-slate-900" dir="auto">
            {m.name}
          </div>
          <div className="num mt-0.5 text-sm text-slate-500" dir="auto">
            {status === 'partial' && entry ? (
              <>
                <span className="font-medium text-amber-800">{fmt(entry.amount)}</span> of {targetLabel(m)}
              </>
            ) : status === 'done' ? (
              <span className="text-brand-700">Done · {targetLabel(m)}</span>
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
            {...expand}
          >
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {(['partial', 'missed'] as EntryStatus[]).map((s) => (
              <StatusButton key={s} s={s} on={status === s} layout="text" disabled={!editable} onClick={() => set(s)} icon={STATUS[s].icon} label={STATUS[s].label} />
            ))}
            {editable && isCounted(m) && (
              <button
                type="button"
                onClick={bump}
                                className="num inline-flex min-h-11 items-center justify-center rounded-md px-2 text-[13px] text-brand-700 hover:text-brand-900"
                aria-label={`Add 1 to ${m.name} (now ${entry ? fmt(entry.status === 'done' ? m.target : entry.amount) : 0} of ${targetLabel(m)})`}
              >
                +1
              </button>
            )}
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
        <StatusButton s="done" on={status === 'done'} layout="circle" disabled={!editable} onClick={() => set('done')} icon={<IconCheck size={20} weight={status === 'done' ? 'bold' : 'regular'} />} label="Done" />
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
  hideMarkRest,
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
  /** The page shows its own big "mark the rest done" button instead. */
  hideMarkRest?: boolean;
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
      {editable && !asAdmin && !hideMarkRest && remaining.length > 0 && (
        <button
          type="button"
          onClick={markRest}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 self-end px-1 text-sm text-brand-700 hover:text-brand-900"
        >
          <IconCheck size={16} />
          {remaining.length === mamoolaat.length ? 'Mark all done' : `Mark the other ${remaining.length} done`}
        </button>
      )}
      <ul className="divide-y divide-slate-200 border-y border-slate-200" aria-label="Checklist">
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
