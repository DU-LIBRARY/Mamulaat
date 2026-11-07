import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { bulkUpdateUsers, createClass, deleteClass, renameClass } from '../../lib/db';
import { EmptyState, Spinner } from '../../components/ui';
import { useDialog } from '../../components/Dialog';
import { ClassSelect } from './Students';
import type { ClassDoc, UserProfile } from '../../types';

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
                    <div className="text-sm text-slate-500">{members.length} active students</div>
                  </div>
                  <Link className="btn-secondary px-3" to={`/admin/class/${c.id}`}>
                    Day
                  </Link>
                  <Link className="btn-secondary px-3" to={`/admin/class/${c.id}?view=week`}>
                    Week
                  </Link>
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
              {deleting === c.id && <DeletePanel c={c} classes={classes.data} related={related} done={() => setDeleting(null)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
