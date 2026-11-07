import { useState, type FormEvent } from 'react';
import { addMamool, deleteMamoolForever, removeMamool, reorderMamoolaat, restoreMamool, updateMamool, type Actor } from '../lib/db';
import type { Mamool } from '../types';
import { targetLabel } from './Checklist';
import { EmptyState } from './ui';
import { useDialog } from './Dialog';
import { IconPlus } from './icons';

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
    <form onSubmit={submit} className="flex flex-col gap-3">
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
  const { confirm } = useDialog();
  const byAdmin = actor.uid !== uid;
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
        <ul className="sheet">
          {active.map((m, i) => (
            <li key={m.id} className="px-3 py-2.5">
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
                    <button className="btn-ghost min-h-9 px-2.5 py-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button className="btn-ghost min-h-9 px-2.5 py-0" onClick={() => move(i, 1)} disabled={i === active.length - 1} aria-label="Move down">
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium break-words text-slate-900" dir="auto">
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
                    className="btn-ghost px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={async () => {
                      if (await confirm({ title: `Remove "${m.name}"?`, message: 'Past logs are kept. You can restore it later.', confirmLabel: 'Remove', danger: true })) removeMamool(uid, m, today, actor);
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
        <h2 className="section-title">Add a mamool</h2>
        <MamoolForm submitLabel="Add" onSubmit={(v) => addMamool(uid, v, nextOrder, today, actor)} />
        {showSuggestions && (
          <div className="mt-3">
            <div className="mb-2 text-xs text-slate-500">Common mamoolaat</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.filter((s) => !active.some((m) => m.name === s.name)).map((s, i) => (
                <button key={s.name} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-brand-500 hover:text-brand-800" dir="auto" onClick={() => addMamool(uid, s, nextOrder + i, today, actor)}>
                  <IconPlus size={14} className="text-slate-400" />{s.name} {s.unit || s.target !== 1 ? <span className="text-slate-500">{targetLabel(s)}</span> : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {removed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">Removed ({removed.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {removed.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 line-through" dir="auto">
                  {m.name} – {targetLabel(m)}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button className="btn-ghost text-sm" onClick={() => restoreMamool(uid, m, today, actor)}>
                    Restore
                  </button>
                  {byAdmin && (
                    <button
                      className="btn-ghost text-sm text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (await confirm({ title: `Delete "${m.name}" forever?`, message: 'It disappears completely (it can no longer be restored). Entries already logged for it stop showing in the history.', confirmLabel: 'Delete forever', danger: true })) deleteMamoolForever(uid, m, actor);
                      }}
                    >
                      Delete forever
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
