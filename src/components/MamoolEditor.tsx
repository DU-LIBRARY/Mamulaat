import { useState, type FormEvent } from 'react';
import { addMamool, removeMamool, reorderMamoolaat, restoreMamool, updateMamool, type Actor } from '../lib/db';
import type { Mamool } from '../types';
import { targetLabel } from './Checklist';
import { EmptyState } from './ui';

export const SUGGESTIONS: Array<{ name: string; target: number; unit: string }> = [
  { name: 'Quran tilawat', target: 1, unit: 'juz' },
  { name: 'Tasbeeh', target: 100, unit: 'times' },
  { name: 'Durood Shareef', target: 100, unit: 'times' },
  { name: 'Istighfar', target: 100, unit: 'times' },
  { name: 'Morning & evening adhkar', target: 1, unit: '' },
  { name: 'Tahajjud', target: 2, unit: 'rakat' },
  { name: 'Hifz revision', target: 1, unit: 'page' },
  { name: 'سورۃ الملک', target: 1, unit: '' },
];

export function MamoolForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; target: number; unit: string };
  submitLabel: string;
  onSubmit: (v: { name: string; target: number; unit: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(String(initial?.target ?? 1));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = Number(target);
    if (!name.trim() || !(t > 0)) return;
    onSubmit({ name: name.trim(), target: t, unit: unit.trim() });
    if (!initial) {
      setName('');
      setTarget('1');
      setUnit('');
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div>
        <label className="label">Name</label>
        <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quran, Tasbeeh, تسبیح" maxLength={120} required />
      </div>
      <div className="flex gap-2">
        <div className="w-28">
          <label className="label">Target</label>
          <input className="input" type="number" inputMode="decimal" min={0.01} step="any" value={target} onChange={(e) => setTarget(e.target.value)} required />
        </div>
        <div className="flex-1">
          <label className="label">Unit (optional)</label>
          <input className="input" dir="auto" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="juz, pages, times…" maxLength={40} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function MamoolEditor({ uid, all, today, actor, showSuggestions = false }: { uid: string; all: Mamool[]; today: string; actor: Actor; showSuggestions?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const active = all.filter((m) => m.active);
  const removed = all.filter((m) => !m.active);
  const nextOrder = all.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);

  const move = (i: number, dir: -1 | 1) => {
    const list = [...active];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    reorderMamoolaat(uid, list, actor);
  };

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <EmptyState>No mamoolaat yet. Add the first one below.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((m, i) => (
            <li key={m.id} className="card p-3">
              {editing === m.id ? (
                <MamoolForm
                  initial={m}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={(v) => {
                    updateMamool(uid, m, v, actor);
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button className="btn-ghost min-h-8 px-2 py-0 text-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      ▲
                    </button>
                    <button className="btn-ghost min-h-8 px-2 py-0 text-sm" onClick={() => move(i, 1)} disabled={i === active.length - 1} aria-label="Move down">
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words" dir="auto">
                      {m.name}
                    </div>
                    <div className="text-sm text-slate-500" dir="auto">
                      {targetLabel(m)}
                    </div>
                  </div>
                  <button className="btn-secondary px-3" onClick={() => setEditing(m.id)}>
                    Edit
                  </button>
                  <button
                    className="btn-ghost px-3 text-red-600"
                    onClick={() => {
                      if (confirm(`Remove "${m.name}"? Past logs are kept.`)) removeMamool(uid, m, today, actor);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="card">
        <div className="section-title">Add a mamool</div>
        <MamoolForm submitLabel="+ Add" onSubmit={(v) => addMamool(uid, v, nextOrder, today, actor)} />
        {showSuggestions && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-slate-500">Quick add:</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.filter((s) => !active.some((m) => m.name === s.name)).map((s, i) => (
                <button key={s.name} className="chip min-h-9 bg-brand-50 px-3 text-sm text-brand-700 ring-1 ring-brand-200" dir="auto" onClick={() => addMamool(uid, s, nextOrder + i, today, actor)}>
                  + {s.name} {s.unit || s.target !== 1 ? `– ${targetLabel(s)}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {removed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-600">Removed ({removed.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {removed.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 line-through" dir="auto">
                  {m.name} – {targetLabel(m)}
                </span>
                <button className="btn-ghost text-sm" onClick={() => restoreMamool(uid, m, actor)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
