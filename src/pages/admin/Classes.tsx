import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { applyTemplate, bulkUpdateUsers, createClass, deleteClass, renameClass, sameMamoolName, saveClassTemplate } from '../../lib/db';
import { EmptyState, Notice, Spinner } from '../../components/ui';
import { useDialog } from '../../components/Dialog';
import { useUndo } from '../../components/Undo';
import { MamoolForm, SUGGESTIONS } from '../../components/MamoolEditor';
import { targetLabel } from '../../components/Checklist';
import { IconPlus } from '../../components/icons';
import { ClassSelect } from './Students';
import type { ClassDoc, TemplateItem, UserProfile } from '../../types';

/**
 * The class's standard mamoolaat. They are ADDED to each student's own list (never replacing it):
 * automatically when a student is approved into the class, or for everyone now with one tap.
 * Students keep their own items and can tidy any overlaps themselves.
 */
function TemplatePanel({ c, members }: { c: ClassDoc; members: UserProfile[] }) {
  const { actor, today } = useActiveSession();
  const { confirm, notify } = useDialog();
  const undo = useUndo();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const items = c.template ?? [];
  const save = (next: TemplateItem[]) => saveClassTemplate(c.id, next, actor).catch((e) => notify('Could not save', (e as Error).message));
  const add = (t: TemplateItem) => {
    if (items.some((x) => sameMamoolName(x.name, t.name))) return void notify('Already in the template', `“${t.name}” is already in this class's list.`);
    if (items.length >= 50) return void notify('Template is full', 'A class template can have up to 50 mamoolaat.');
    save([...items, t]);
  };

  const applyNow = async () => {
    if (!items.length || !members.length) return;
    const ok = await confirm({
      title: `Add ${items.length} mamool${items.length === 1 ? '' : 'aat'} to ${members.length} student${members.length === 1 ? '' : 's'}?`,
      message: (
        <>
          <p>Each student keeps their own list. These are added at the end, starting today; anything a student already has with the same name is skipped.</p>
          <p className="mt-2">Students see what was added in their Inbox and can remove or rename anything that overlaps.</p>
        </>
      ),
      confirmLabel: 'Add to students',
    });
    if (!ok) return;
    if (!navigator.onLine) return void notify('You are offline', 'Adding to students needs an internet connection.');
    setBusy(true);
    setResult(null);
    try {
      const r = await applyTemplate(members.map((m) => m.id), items, today, actor);
      setResult(`Added ${r.added} mamool${r.added === 1 ? '' : 'aat'} in total${r.skipped ? `; skipped ${r.skipped} that students already had` : ''}.`);
    } catch (e) {
      await notify('Could not finish', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-600">
        Mamoolaat everyone in <b dir="auto">{c.name}</b> should do. They are <b>added</b> to each student's own list — when you approve someone into this class, or now with the button
        below. Nothing a student already has is removed.
      </p>
      {items.length === 0 ? (
        <EmptyState>No class mamoolaat yet.</EmptyState>
      ) : (
        <ul className="sheet">
          {items.map((t, i) => (
            <li key={`${t.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words text-slate-900" dir="auto">
                  {t.name}
                </span>
                <span className="text-sm text-slate-500" dir="auto">
                  {targetLabel(t)}
                </span>
              </span>
              <button
                className="btn-ghost min-h-11 px-3 text-sm text-red-700"
                aria-label={`Remove ${t.name} from the class template`}
                onClick={() => {
                  save(items.filter((_, j) => j !== i));
                  undo.undoable(`Removed “${t.name}” from the template`, () => save(items));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <MamoolForm submitLabel="Add to template" onSubmit={add} />
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.filter((x) => !items.some((t) => sameMamoolName(t.name, x.name))).map((x) => (
          <button key={x.name} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-surface px-3 text-sm text-slate-700 hover:border-brand-500" dir="auto" onClick={() => add(x)}>
            <IconPlus size={14} className="text-slate-400" />
            {x.name}
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <button className="btn-primary" disabled={busy || !members.length} onClick={applyNow}>
          {busy ? 'Adding…' : members.length ? `Add to all ${members.length} student${members.length === 1 ? '' : 's'} now` : 'No active students in this class yet'}
        </button>
      )}
      {result && <Notice tone="info">{result}</Notice>}
    </div>
  );
}

/** Inline panel: move everyone out (optional), then delete the class. */
function DeletePanel({ c, classes, related, done }: { c: ClassDoc; classes: ClassDoc[]; related: UserProfile[]; done: () => void }) {
  const { actor } = useActiveSession();
  const { notify } = useDialog();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const others = classes.filter((x) => x.id !== c.id);
  const inClass = related.filter((u) => u.classId === c.id);
  const requests = related.filter((u) => u.requestedClassId === c.id && u.classId !== c.id);

  const go = async () => {
    setBusy(true);
    try {
      await deleteClass(c.id, actor, related, target || null);
      done();
    } catch (e) {
      await notify('Could not delete the class', (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-red-50 p-3">
      <b dir="auto">Delete “{c.name}”?</b>
      {inClass.length > 0 && (
        <>
          <p className="text-sm text-slate-700">
            {inClass.length} {inClass.length === 1 ? 'person is' : 'people are'} in this class. Move them to another class first, or leave them with no class.
          </p>
          <ClassSelect classes={others} value={target} onChange={setTarget} placeholder="No class (decide later)" label="Move students to" />
        </>
      )}
      {requests.length > 0 && <p className="text-sm text-slate-700">{requests.length} pending sign-up{requests.length === 1 ? '' : 's'} asked for this class and will be asked to pick another.</p>}
      <div className="flex gap-2">
        <button className="btn-danger flex-1" disabled={busy} onClick={go}>
          {busy ? 'Deleting…' : inClass.length && target ? 'Move students and delete class' : 'Delete class'}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={done}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Classes() {
  const { actor } = useActiveSession();
  const classes = useClasses();
  const users = useAllUsers();
  const { notify } = useDialog();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [templateFor, setTemplateFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (classes.loading || users.loading) return <Spinner />;
  const taken = (n: string, except?: string) => classes.data.some((c) => c.id !== except && c.name.trim().toLowerCase() === n.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-4">
      <form
        className="card flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          if (taken(n)) return void notify('That class already exists', `There is already a class called “${n}”.`);
          createClass(n, actor);
          setName('');
        }}
      >
        <input className="input" dir="auto" placeholder="New class name" aria-label="New class name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <button className="btn-primary" type="submit" disabled={!name.trim()}>
          Create
        </button>
      </form>
      {classes.error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load classes: {classes.error.message}</div>}
      {classes.data.length === 0 && <EmptyState>No classes yet.</EmptyState>}
      <ul className="flex flex-col gap-2">
        {classes.data.map((c) => {
          const members = users.data.filter((u) => u.classId === c.id && u.status === 'active');
          const related = users.data.filter((u) => u.classId === c.id || u.requestedClassId === c.id);
          return (
            <li key={c.id} className="card p-3">
              {editing === c.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = editName.trim();
                    if (!n) return;
                    if (taken(n, c.id)) return void notify('That class already exists', `There is already a class called “${n}”.`);
                    if (n !== c.name) renameClass(c.id, n, actor);
                    setEditing(null);
                  }}
                >
                  <input className="input" dir="auto" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} autoFocus aria-label="Class name" />
                  <button className="btn-primary" disabled={!editName.trim()}>
                    Save
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words" dir="auto">
                      {c.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      {members.length} active students{c.template?.length ? ` · ${c.template.length} class mamoolaat` : ''}
                    </div>
                  </div>
                  <Link className="btn-secondary px-3" to={`/admin/class/${c.id}`}>
                    Day
                  </Link>
                  <Link className="btn-secondary px-3" to={`/admin/class/${c.id}?view=week`}>
                    Week
                  </Link>
                  <button className="btn-ghost px-3" aria-expanded={templateFor === c.id} onClick={() => setTemplateFor(templateFor === c.id ? null : c.id)}>
                    Mamoolaat
                  </button>
                  <button
                    className="btn-ghost px-3"
                    onClick={() => {
                      setEditing(c.id);
                      setEditName(c.name);
                    }}
                  >
                    Rename
                  </button>
                  {classes.data.length > 1 && related.some((u) => u.classId === c.id) && (
                    <button
                      className="btn-ghost px-3"
                      onClick={() => {
                        setMoveFrom(moveFrom === c.id ? null : c.id);
                        setMoveTo('');
                      }}
                    >
                      Move all…
                    </button>
                  )}
                  <button className="btn-ghost px-3 text-red-700" onClick={() => setDeleting(deleting === c.id ? null : c.id)}>
                    Delete
                  </button>
                </div>
              )}
              {moveFrom === c.id && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="min-w-40 flex-1">
                    <ClassSelect classes={classes.data.filter((x) => x.id !== c.id)} value={moveTo} onChange={setMoveTo} placeholder="Move everyone to…" label="Move everyone to" />
                  </div>
                  <button
                    className="btn-primary"
                    disabled={!moveTo || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await bulkUpdateUsers(related.filter((u) => u.classId === c.id).map((u) => u.id), { kind: 'move', classId: moveTo }, actor);
                        setMoveFrom(null);
                      } catch (e) {
                        await notify('Could not move students', (e as Error).message);
                      }
                      setBusy(false);
                    }}
                  >
                    Move
                  </button>
                </div>
              )}
              {templateFor === c.id && <TemplatePanel c={c} members={members.filter((u) => u.role === 'student')} />}
              {deleting === c.id && <DeletePanel c={c} classes={classes.data} related={related} done={() => setDeleting(null)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
