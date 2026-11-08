import { useId, useState, type ReactNode } from 'react';
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

const STATUS: Record<EntryStatus, { label: string; icon: ReactNode; on: string }> = {
  done: { label: 'Done', icon: <IconCheck size={18} />, on: 'bg-brand-700 text-white border-brand-700' },
  partial: { label: 'Partly', icon: <IconHalf size={16} />, on: 'bg-amber-100 text-amber-900 border-amber-300' },
  missed: { label: 'Missed', icon: <IconX size={16} />, on: 'bg-red-50 text-red-800 border-red-200' },
};

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
      <li className={`relative px-3 py-2.5 before:absolute before:inset-y-2.5 sm:px-4 before:left-0 before:w-[3px] before:rounded-r ${edge(status)}`}>
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
            {(Object.keys(STATUS) as EntryStatus[]).map((s) => {
              const main = s === 'done';
              const idle = main
                ? 'border-brand-700 bg-white text-brand-800 hover:bg-brand-50'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50';
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!editable}
                  onClick={() => set(s)}
                  aria-pressed={status === s}
                  aria-label={STATUS[s].label}
                  title={STATUS[s].label}
                  className={`inline-flex h-12 w-12 items-center justify-center gap-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-24 sm:px-3 ${
                    main ? 'font-semibold' : 'font-medium'
                  } ${status === s ? STATUS[s].on : idle}`}
                >
                  {COMPACT_ICON[s]}
                  <span className="hidden text-sm sm:inline" aria-hidden="true">
                    {STATUS[s].label}
                  </span>
                </button>
              );
            })}
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
    <li className={`relative px-4 py-3.5 before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r ${edge(status)}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[17px] leading-snug font-medium break-words text-slate-900" dir="auto">
            {m.name}
          </div>
          <div className="num mt-0.5 text-sm text-slate-500" dir="auto">
            {status === 'partial' && entry ? (
              <>
                <span className="font-medium text-amber-800">{fmt(entry.amount)}</span> of {targetLabel(m)}
              </>
            ) : (
              targetLabel(m)
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showPercent && entry && <div className="num text-sm font-medium text-slate-500">{Math.round(f * 100)}%</div>}
          {editable && isCounted(m) && status !== 'done' && (
            <button
              type="button"
              onClick={bump}
              className="num inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-brand-200 bg-brand-50 px-2.5 text-sm font-semibold text-brand-800 hover:border-brand-500"
              aria-label={`Add 1 to ${m.name} (now ${entry ? fmt(entry.status === 'done' ? m.target : entry.amount) : 0} of ${targetLabel(m)})`}
            >
              +1
            </button>
          )}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {m.name}: {statusText(entry, m)}
      </span>
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2" role="group" aria-label={`${m.name} status`}>
        {(Object.keys(STATUS) as EntryStatus[]).map((s) => {
          const main = s === 'done';
          const idle = main
            ? 'border-brand-700 bg-white text-brand-800 hover:bg-brand-50'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50';
          return (
            <button
              key={s}
              type="button"
              disabled={!editable}
              onClick={() => set(s)}
              aria-pressed={status === s}
              className={`inline-flex min-h-11 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                main ? 'gap-1.5 text-[15px] font-semibold' : 'gap-1 text-xs font-medium'
              } ${status === s ? STATUS[s].on : idle}`}
            >
              {STATUS[s].icon}
              {STATUS[s].label}
            </button>
          );
        })}
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
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md border border-brand-200 bg-white px-3 text-sm font-medium text-brand-800 hover:border-brand-500 hover:bg-brand-50"
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
