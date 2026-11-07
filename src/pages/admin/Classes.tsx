import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { createClass, deleteClass, renameClass } from '../../lib/db';
import { EmptyState } from '../../components/ui';

export function Classes() {
  const { actor } = useActiveSession();
  const classes = useClasses();
  const users = useAllUsers();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <form
        className="card flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createClass(name, actor);
          setName('');
        }}
      >
        <input className="input" dir="auto" placeholder="New class name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <button className="btn-primary" type="submit">
          Create
        </button>
      </form>
      {classes.data.length === 0 && <EmptyState>No classes yet.</EmptyState>}
      <ul className="flex flex-col gap-2">
        {classes.data.map((c) => {
          const members = users.data.filter((u) => u.classId === c.id && u.status === 'active');
          return (
            <li key={c.id} className="card p-3">
              {editing === c.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim()) renameClass(c.id, editName, actor);
                    setEditing(null);
                  }}
                >
                  <input className="input" dir="auto" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <button className="btn-primary">Save</button>
                  <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold" dir="auto">
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
                  <button
                    className="btn-ghost px-3 text-red-600"
                    disabled={members.length > 0}
                    title={members.length ? 'Move students out first' : undefined}
                    onClick={() => confirm(`Delete class "${c.name}"?`) && deleteClass(c.id, actor)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
