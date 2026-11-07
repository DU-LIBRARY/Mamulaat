import { useState, type ReactNode } from 'react';
import { adminSaveEntry, saveEntry, type Actor } from '../lib/db';
import type { DayLog, EntryStatus, LogEntry, Mamool } from '../types';
import { entryFraction } from '../lib/scoring';
import { IconCheck, IconHalf, IconX } from './icons';

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function targetLabel(m: Pick<Mamool, 'target' | 'unit'>) {
  return `${fmt(m.target)}${m.unit ? ` ${m.unit}` : ''}`;
}

const STATUS: Record<EntryStatus, { label: string; icon: ReactNode; on: string }> = {
  done: { label: 'Done', icon: <IconCheck size={18} />, on: 'bg-brand-700 text-white border-brand-700' },
  partial: { label: 'Partly', icon: <IconHalf size={16} />, on: 'bg-amber-100 text-amber-900 border-amber-300' },
  missed: { label: 'Missed', icon: <IconX size={16} />, on: 'bg-red-50 text-red-800 border-red-200' },
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
  onChange,
}: {
  m: Mamool;
  entry: LogEntry | undefined;
  editable: boolean;
  onChange: (e: LogEntry | null) => void;
}) {
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
    if (status === s) onChange(null); // tap again to clear
    else onChange({ status: s, amount: s === 'done' ? m.target : 0, target: m.target });
  };

  const savePartial = () => {
    const a = Math.max(0, Number(amount) || 0);
    setEditingPartial(false);
    if (a >= m.target) onChange({ status: 'done', amount: m.target, target: m.target });
    else if (a <= 0) onChange({ status: 'missed', amount: 0, target: m.target });
    else onChange({ status: 'partial', amount: a, target: m.target });
  };

  return (
    <li className={`relative px-4 py-3.5 before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r ${edge(status)}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
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
        {entry && <div className="num shrink-0 text-sm font-medium text-slate-500">{Math.round(f * 100)}%</div>}
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={`${m.name} status`}>
        {(Object.keys(STATUS) as EntryStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={!editable}
            onClick={() => set(s)}
            aria-pressed={status === s}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              status === s ? STATUS[s].on : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {STATUS[s].icon}
            {STATUS[s].label}
          </button>
        ))}
      </div>
      {editingPartial && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl"
            aria-label="Less"
            onClick={() => setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))}
          >
            −
          </button>
          <input
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
          <button type="button" className="btn-secondary h-11 w-11 shrink-0 px-0 text-xl" aria-label="More" onClick={() => setAmount(String((Number(amount) || 0) + 1))}>
            +
          </button>
          <span className="shrink-0 text-sm text-slate-500" dir="auto">
            of {targetLabel(m)}
          </span>
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
}: {
  uid: string;
  day: string;
  mamoolaat: Mamool[];
  log: DayLog | undefined;
  editable: boolean;
  /** When the admin edits a student's day: the edit is stamped and audited. */
  asAdmin?: Actor;
}) {
  return (
    <ul className="sheet">
      {mamoolaat.map((m) => (
        <MamoolRow
          key={m.id + day}
          m={m}
          entry={log?.entries?.[m.id]}
          editable={editable}
          onChange={(e) => (asAdmin ? adminSaveEntry(uid, day, m, e, asAdmin) : saveEntry(uid, day, m.id, e))}
        />
      ))}
    </ul>
  );
}
