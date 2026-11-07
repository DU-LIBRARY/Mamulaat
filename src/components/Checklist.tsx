import { useState } from 'react';
import { saveEntry } from '../lib/db';
import type { DayLog, EntryStatus, LogEntry, Mamool } from '../types';
import { entryFraction } from '../lib/scoring';

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function targetLabel(m: Pick<Mamool, 'target' | 'unit'>) {
  return `${fmt(m.target)}${m.unit ? ` ${m.unit}` : ''}`;
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

  const btn = (s: EntryStatus, label: string, active: string) => (
    <button
      type="button"
      disabled={!editable}
      onClick={() => set(s)}
      aria-pressed={status === s}
      className={`btn min-h-12 flex-1 px-2 text-sm ${status === s ? active : 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </button>
  );

  return (
    <li className="card p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg leading-tight font-semibold break-words" dir="auto">
            {m.name}
          </div>
          <div className="text-sm text-slate-500" dir="auto">
            Target: {targetLabel(m)}
            {status === 'partial' && entry && (
              <span className="ml-2 font-semibold text-amber-700">
                · {fmt(entry.amount)}/{fmt(entry.target)}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-slate-400">{entry ? `${Math.round(f * 100)}%` : ''}</div>
      </div>
      <div className="flex gap-2">
        {btn('done', '✓ Done', 'bg-brand-600 text-white')}
        {btn('partial', '½ Partly', 'bg-amber-400 text-amber-950')}
        {btn('missed', '✕ Missed', 'bg-red-500 text-white')}
      </div>
      {editingPartial && (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn-secondary h-12 w-12 text-xl" onClick={() => setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))}>
            −
          </button>
          <input
            className="input text-center text-lg"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Amount of ${m.name}`}
            autoFocus
          />
          <button type="button" className="btn-secondary h-12 w-12 text-xl" onClick={() => setAmount(String((Number(amount) || 0) + 1))}>
            +
          </button>
          <span className="shrink-0 text-sm text-slate-500" dir="auto">
            / {targetLabel(m)}
          </span>
          <button type="button" className="btn-primary" onClick={savePartial}>
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
}: {
  uid: string;
  day: string;
  mamoolaat: Mamool[];
  log: DayLog | undefined;
  editable: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {mamoolaat.map((m) => (
        <MamoolRow
          key={m.id + day}
          m={m}
          entry={log?.entries?.[m.id]}
          editable={editable}
          onChange={(e) => saveEntry(uid, day, m.id, e)}
        />
      ))}
    </ul>
  );
}
