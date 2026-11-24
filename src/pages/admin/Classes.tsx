import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { syncClassMamoolaatFor, bulkUpdateUsers, createClass, deleteClass, moveMonitorNames, renameClass, sameMamoolName, saveClassTemplate } from '../../lib/db';
import { EmptyState, Spinner } from '../../components/ui';
import { useDialog } from '../../components/Dialog';
import { useUndo } from '../../components/Undo';
import { MamoolForm, SUGGESTIONS } from '../../components/MamoolEditor';
import { targetLabel } from '../../components/Checklist';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/icons';
import { ClassSelect } from './Students';
import type { ClassDoc, TemplateItem, UserProfile } from '../../types';

/**
 * The class's mamoolaat. Saving the list applies it to everyone in the class (even if the class
 * is empty for now, it's kept for whoever joins): students who join get it, and lose the class
 * mamoolaat of the class they left. Their personal mamoolaat are never touched.
 */
function TemplatePanel({ c, members }: { c: ClassDoc; members: UserProfile[] }) {
  const { actor, today, limited } = useActiveSession();
  const { notify } = useDialog();
  const undo = useUndo();
  const items = c.template ?? [];
  const save = async (next: TemplateItem[]) => {
    try {
      await saveClassTemplate(c.id, next, actor);
      // A limited admin can't write students' lists: each student's app applies it when it opens.
      if (!limited && members.length) await syncClassMamoolaatFor(members.map((m) => m.id), { id: c.id, template: next }, today, actor);
    } catch (e) {
      await notify('Could not save', (e as Error).message);
    }
  };
  const add = (t: TemplateItem) => {
    if (items.some((x) => sameMamoolName(x.name, t.name))) return void notify('Already in the list', `“${t.name}” is already in this class's mamoolaat.`);
    if (items.length >= 50) return void notify('List is full', 'A class can have up to 50 mamoolaat.');
    void save([...items, t]);
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-600">
        Mamoolaat everyone in <b dir="auto">{c.name}</b> does. Changes apply to the whole class straight away, and to anyone who joins later. Students keep their own mamoolaat.
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
                aria-label={`Remove ${t.name} from the class mamoolaat`}
                onClick={() => {
                  void save(items.filter((_, j) => j !== i));
                  undo.undoable(`Removed “${t.name}” from the class`, () => save(items));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <MamoolForm submitLabel="Add to class" onSubmit={add} />
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.filter((x) => !items.some((t) => sameMamoolName(t.name, x.name))).map((x) => (
          <button key={x.name} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-200 bg-surface px-3 text-sm text-slate-700 hover:border-brand-500" dir="auto" onClick={() => add(x)}>
            <IconPlus size={14} className="text-slate-400" />
            {x.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Inline panel: move everyone out (optional), then delete the class. */
function DeletePanel({ c, classes, related, done }: { c: ClassDoc; classes: ClassDoc[]; related: UserProfile[]; done: () => void }) {
  const { actor, today, limited } = useActiveSession();
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
      if (!limited) await syncClassMamoolaatFor(inClass.filter((u) => u.role === 'student').map((u) => u.id), classes.find((x) => x.id === target) ?? null, today, actor);
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
  const { actor, today, limited } = useActiveSession();
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
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Older versions kept the monitor's name on the class itself: move any that are left.
  useEffect(() => {
    if (!classes.loading && !classes.fromCache) moveMonitorNames(classes.data);
  }, [classes.loading, classes.fromCache, classes.data]);

  if (classes.loading || users.loading) return <Spinner />;
  const taken = (n: string, except?: string) => classes.data.some((c) => c.id !== except && c.name.trim().toLowerCase() === n.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print">
        <Link to="/admin/students" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <IconChevronLeft size={16} /> Students
        </Link>
        <h1 className="display text-[34px] leading-tight">Manage classes</h1>
      </div>
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
                <>
                  <Link to={`/admin/class/${c.id}`} className="-m-1 flex items-center gap-3 rounded-lg p-1 hover:bg-slate-100/60">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold break-words text-slate-900" dir="auto">
                        {c.name}
                      </div>
                      <div className="mt-0.5 text-sm text-slate-500" dir="auto">
                        <span className="num">{members.length}</span> student{members.length === 1 ? '' : 's'}
                        {c.template?.length ? <> · <span className="num">{c.template.length}</span> class mamoolaat</> : null}
                        {' · '}Fajr monitor: {c.fajrMonitorId ? (users.data.find((u) => u.id === c.fajrMonitorId)?.name ?? 'someone') : 'none'}
                        {c.weekendRepId ? <>{' · '}Weekend salah: {users.data.find((u) => u.id === c.weekendRepId)?.name ?? 'someone'}</> : null}
                      </div>
                    </div>
                    <IconChevronRight size={18} className="shrink-0 text-slate-400" />
                  </Link>
                  <div className="mt-2 -ml-2 flex flex-wrap items-center gap-x-1 border-t border-slate-200 pt-1 text-sm">
                    <button className="btn-ghost min-h-11 px-2 text-sm" aria-expanded={templateFor === c.id} onClick={() => setTemplateFor(templateFor === c.id ? null : c.id)}>
                      Class mamoolaat
                    </button>
                    <button className="btn-ghost ml-auto min-h-11 px-2 text-sm" aria-expanded={moreFor === c.id} onClick={() => setMoreFor(moreFor === c.id ? null : c.id)}>
                      {moreFor === c.id ? 'Less' : 'More…'}
                    </button>
                  </div>
                  {moreFor === c.id && (
                    <div className="-ml-2 flex flex-wrap items-center gap-x-1 text-sm">
                      <Link className="btn-ghost min-h-11 px-2 text-sm" to={`/admin/class/${c.id}#fajr-monitor`}>
                        Fajr monitor
                      </Link>
                      <Link className="btn-ghost min-h-11 px-2 text-sm" to={`/admin/class/${c.id}#weekend-rep`}>
                        Weekend salah rep
                      </Link>
                      <button
                        className="btn-ghost min-h-11 px-2 text-sm"
                        onClick={() => {
                          setEditing(c.id);
                          setEditName(c.name);
                        }}
                      >
                        Rename
                      </button>
                      {classes.data.length > 1 && related.some((u) => u.classId === c.id) && (
                        <button
                          className="btn-ghost min-h-11 px-2 text-sm"
                          onClick={() => {
                            setMoveFrom(moveFrom === c.id ? null : c.id);
                            setMoveTo('');
                          }}
                        >
                          Move all students…
                        </button>
                      )}
                      <button className="btn-ghost ml-auto min-h-11 px-2 text-sm text-red-700" onClick={() => setDeleting(deleting === c.id ? null : c.id)}>
                        Delete class
                      </button>
                    </div>
                  )}
                </>
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
                        const moving = related.filter((u) => u.classId === c.id).map((u) => u.id);
                        await bulkUpdateUsers(moving, { kind: 'move', classId: moveTo }, actor);
                        if (!limited) await syncClassMamoolaatFor(related.filter((u) => moving.includes(u.id) && u.role === 'student').map((u) => u.id), classes.data.find((x) => x.id === moveTo) ?? null, today, actor);
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
