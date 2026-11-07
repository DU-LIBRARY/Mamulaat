import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { approveUser, deactivateUser, deleteStudent, moveUser, reactivateUser, rejectUser, type Actor } from '../../lib/db';
import { EmptyState, Spinner } from '../../components/ui';
import type { ClassDoc, UserProfile } from '../../types';

export function ClassSelect({ classes, value, onChange, placeholder = 'Choose class…' }: { classes: ClassDoc[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function Avatar({ u }: { u: UserProfile }) {
  return u.photoURL ? (
    <img src={u.photoURL} alt="" className="h-10 w-10 shrink-0 rounded-full" referrerPolicy="no-referrer" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{(u.name ?? u.email)[0]?.toUpperCase()}</div>
  );
}

export async function confirmDelete(u: UserProfile, actor: Actor) {
  const typed = prompt(`This permanently deletes ${u.name ?? u.email} and ALL their mamoolaat, logs and comments.\n\nType DELETE to confirm.`);
  if (typed !== 'DELETE') return false;
  if (!navigator.onLine) {
    alert('You need to be online to delete a student.');
    return false;
  }
  try {
    await deleteStudent(u.id, actor, u.email);
    return true;
  } catch (e) {
    alert(`Delete failed: ${(e as Error).message}`);
    return false;
  }
}

function UserRow({ u, classes, actor }: { u: UserProfile; classes: ClassDoc[]; actor: Actor }) {
  const [cls, setCls] = useState(u.classId ?? u.requestedClassId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setErr((e as Error).message));
  return (
    <li className="card flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          {u.status === 'active' ? (
            <Link to={`/admin/student/${u.id}`} className="block truncate font-semibold text-brand-700" dir="auto">
              {u.name ?? u.email}
            </Link>
          ) : (
            <div className="truncate font-semibold" dir="auto">
              {u.name ?? u.email}
            </div>
          )}
          <div className="truncate text-sm text-slate-500">{u.email}</div>
          {u.status === 'pending' && (
            <div className="text-sm text-slate-600" dir="auto">
              {u.signupComplete ? `Requested: ${classes.find((c) => c.id === u.requestedClassId)?.name ?? 'a class that no longer exists'}` : 'Has not entered their name/class yet'}
            </div>
          )}
        </div>
      </div>
      {u.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <div className="min-w-40 flex-1">
            <ClassSelect classes={classes} value={cls} onChange={setCls} />
          </div>
          <button className="btn-primary" disabled={!cls} onClick={() => run(approveUser(u.id, cls, actor))}>
            Approve
          </button>
          <button className="btn-ghost text-red-600" onClick={() => confirm(`Reject ${u.email}?`) && run(rejectUser(u.id, actor))}>
            Reject
          </button>
        </div>
      )}
      {u.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          <div className="min-w-40 flex-1">
            <ClassSelect classes={classes} value={u.classId ?? ''} onChange={(v) => v && run(moveUser(u.id, v, actor))} placeholder="No class" />
          </div>
          <button className="btn-ghost" onClick={() => confirm(`Deactivate ${u.name ?? u.email}? They will lose access until reactivated.`) && run(deactivateUser(u.id, actor))}>
            Deactivate
          </button>
        </div>
      )}
      {(u.status === 'inactive' || u.status === 'rejected') && (
        <div className="flex flex-wrap gap-2">
          {u.status === 'inactive' && !u.handedOverTo && (
            <button className="btn-secondary" onClick={() => run(reactivateUser(u.id, actor))}>
              Reactivate
            </button>
          )}
          {u.status === 'rejected' && (
            <>
              <div className="min-w-40 flex-1">
                <ClassSelect classes={classes} value={cls} onChange={setCls} />
              </div>
              <button className="btn-secondary" disabled={!cls} onClick={() => run(approveUser(u.id, cls, actor))}>
                Approve
              </button>
            </>
          )}
          <button className="btn-ghost text-red-600" onClick={() => confirmDelete(u, actor)}>
            Delete
          </button>
        </div>
      )}
      {u.handedOverTo && <div className="text-xs text-slate-500">Former admin (handed over).</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </li>
  );
}

export function Students() {
  const { actor, profile } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const [filter, setFilter] = useState('');
  if (users.loading) return <Spinner />;
  const list = users.data.filter((u) => u.id !== profile.id && (!filter || `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase())));
  const pending = list.filter((u) => u.status === 'pending');
  const active = list.filter((u) => u.status === 'active');
  const other = list.filter((u) => u.status === 'inactive' || u.status === 'rejected');
  const noClass = active.filter((u) => !u.classId || !classes.data.some((c) => c.id === u.classId));

  return (
    <div className="flex flex-col gap-5">
      <input className="input" placeholder="Search name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {classes.data.length === 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Create a class first (<Link className="underline" to="/admin/classes">Classes</Link>) — students must be assigned to one when approved.
        </div>
      )}
      <section>
        <div className="section-title">Waiting for approval ({pending.length})</div>
        {pending.length === 0 ? <EmptyState>No pending sign-ups.</EmptyState> : <ul className="flex flex-col gap-2">{pending.map((u) => <UserRow key={u.id} u={u} classes={classes.data} actor={actor} />)}</ul>}
      </section>
      {classes.data.map((c) => {
        const members = active.filter((u) => u.classId === c.id);
        if (!members.length) return null;
        return (
          <section key={c.id}>
            <div className="section-title" dir="auto">
              {c.name} ({members.length})
            </div>
            <ul className="flex flex-col gap-2">
              {members.map((u) => (
                <UserRow key={u.id} u={u} classes={classes.data} actor={actor} />
              ))}
            </ul>
          </section>
        );
      })}
      {noClass.length > 0 && (
        <section>
          <div className="section-title">Active, no class ({noClass.length})</div>
          <ul className="flex flex-col gap-2">
            {noClass.map((u) => (
              <UserRow key={u.id} u={u} classes={classes.data} actor={actor} />
            ))}
          </ul>
        </section>
      )}
      {other.length > 0 && (
        <section>
          <div className="section-title">Inactive / rejected ({other.length})</div>
          <ul className="flex flex-col gap-2">
            {other.map((u) => (
              <UserRow key={u.id} u={u} classes={classes.data} actor={actor} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
