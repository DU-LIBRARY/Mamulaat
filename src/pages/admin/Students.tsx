import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses } from '../../hooks/useAdminData';
import { approveUser, bulkUpdateUsers, deactivateUser, deleteStudent, moveUser, reactivateUser, rejectUser, type Actor, type BulkAction } from '../../lib/db';
import { EmptyState, Spinner } from '../../components/ui';
import { useDialog } from '../../components/Dialog';
import type { ClassDoc, UserProfile } from '../../types';
import { displayName } from '../../lib/display';

export function ClassSelect({ classes, value, onChange, placeholder = 'Choose class…', label }: { classes: ClassDoc[]; value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  // A stale id (class deleted) must show as "no class", not as a silent invalid value.
  const v = classes.some((c) => c.id === value) ? value : '';
  return (
    <select className="input" value={v} onChange={(e) => onChange(e.target.value)} aria-label={label ?? placeholder}>
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{(displayName(u))[0]?.toUpperCase()}</div>
  );
}

/** Confirmation + deletion of one or more users (all their data goes too). Returns true if everything was deleted. */
export function useDeleteUsers(actor: Actor) {
  const { confirm, notify } = useDialog();
  return async (users: UserProfile[]) => {
    if (!users.length) return false;
    const many = users.length > 1;
    const who = many ? `${users.length} people` : displayName(users[0]);
    const ok = await confirm({
      title: `Delete ${who} and all their data?`,
      message: (
        <>
          <p>This permanently deletes {many ? 'them' : 'this person'} with every mamool, log, comment and message. It cannot be undone.</p>
          <p className="mt-2">
            Their Google sign-in is <b>not</b> removed. If {many ? 'they sign' : 'they sign'} in again, a brand-new sign-up request appears here. To lock someone out
            without losing their data, use <b>Deactivate</b> or <b>Reject</b> instead.
          </p>
        </>
      ),
      confirmLabel: 'Delete everything',
      danger: true,
      requireText: 'DELETE',
    });
    if (!ok) return false;
    if (!navigator.onLine) {
      await notify('You are offline', 'Deleting needs an internet connection. Try again when you are back online.');
      return false;
    }
    const failed: string[] = [];
    for (const u of users) {
      try {
        await deleteStudent(u.id, actor, displayName(u));
      } catch (e) {
        failed.push(`${displayName(u)}: ${(e as Error).message}`);
      }
    }
    if (failed.length) {
      await notify('Some deletions failed', failed.join('\n'));
      return false;
    }
    return true;
  };
}

function UserRow({ u, classes, actor, selected, onToggle }: { u: UserProfile; classes: ClassDoc[]; actor: Actor; selected: boolean; onToggle: () => void }) {
  const { confirm } = useDialog();
  const del = useDeleteUsers(actor);
  const initial = u.classId ?? u.requestedClassId ?? '';
  const [cls, setCls] = useState(classes.some((c) => c.id === initial) ? initial : '');
  const [err, setErr] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setErr((e as Error).message));
  const requestedName = classes.find((c) => c.id === u.requestedClassId)?.name;
  return (
    <li className={`card flex flex-col gap-2 p-3 ${selected ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex items-center gap-3">
        <label className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center">
          <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={selected} onChange={onToggle} aria-label={`Select ${displayName(u)}`} />
        </label>
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <Link to={`/admin/student/${u.id}`} className="block truncate font-semibold text-brand-700" dir="auto">
            {displayName(u)}
          </Link>
          {u.status === 'pending' && (
            <div className="text-sm text-slate-600" dir="auto">
              {u.signupComplete ? (requestedName ? `Requested: ${requestedName}` : 'Their requested class no longer exists. Pick one below.') : 'Has not entered their name/class yet'}
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
          <button
            className="btn-ghost text-red-600"
            onClick={async () => (await confirm({ title: `Reject ${displayName(u)}?`, message: 'They stay blocked until you approve them.', confirmLabel: 'Reject', danger: true })) && run(rejectUser(u.id, actor))}
          >
            Reject
          </button>
        </div>
      )}
      {u.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          <div className="min-w-40 flex-1">
            <ClassSelect classes={classes} value={u.classId ?? ''} onChange={(v) => v && run(moveUser(u.id, v, actor))} placeholder="No class" />
          </div>
          <button
            className="btn-ghost"
            onClick={async () => (await confirm({ title: `Deactivate ${displayName(u)}?`, message: 'They lose access until you reactivate them. Their data is kept.', confirmLabel: 'Deactivate', danger: true })) && run(deactivateUser(u.id, actor))}
          >
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
        </div>
      )}
      <div>
        <button className="btn-ghost min-h-11 px-2 text-sm text-red-600" onClick={() => del([u])}>
          Delete {u.status === 'active' ? 'student' : 'user'} and all data…
        </button>
      </div>
      {u.handedOverTo && <div className="text-xs text-slate-500">Former admin (handed over).</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </li>
  );
}

function BulkBar({ selected, users, classes, actor, clear }: { selected: UserProfile[]; users: UserProfile[]; classes: ClassDoc[]; actor: Actor; clear: () => void }) {
  const { confirm, notify } = useDialog();
  const del = useDeleteUsers(actor);
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState(false);
  void users;
  const ids = (f: (u: UserProfile) => boolean) => selected.filter(f).map((u) => u.id);
  const canApprove = ids((u) => u.status === 'pending' || u.status === 'rejected');
  const canMove = ids((u) => u.status === 'active');
  const canDeactivate = ids((u) => u.status === 'active');
  const canReactivate = ids((u) => u.status === 'inactive' && !u.handedOverTo);

  const go = async (action: BulkAction, uids: string[], title: string, danger = false) => {
    if (!uids.length) return;
    if (!(await confirm({ title, message: `This applies to ${uids.length} ${uids.length === 1 ? 'person' : 'people'}.`, confirmLabel: 'Apply', danger }))) return;
    setBusy(true);
    try {
      await bulkUpdateUsers(uids, action, actor);
      clear();
    } catch (e) {
      await notify('Could not finish', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-safe fixed inset-x-0 bottom-[4.5rem] z-30 mx-auto max-w-3xl px-3">
      <div className="card flex flex-col gap-2 shadow-lg ring-2 ring-brand-500">
        <div className="flex items-center justify-between">
          <b>{selected.length} selected</b>
          <button className="btn-ghost min-h-11 px-3" onClick={clear}>
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-40 flex-1">
            <ClassSelect classes={classes} value={cls} onChange={setCls} placeholder="Class for approve/move…" />
          </div>
          <button className="btn-primary" disabled={busy || !cls || !canApprove.length} onClick={() => go({ kind: 'approve', classId: cls }, canApprove, `Approve into this class?`)}>
            Approve ({canApprove.length})
          </button>
          <button className="btn-secondary" disabled={busy || !cls || !canMove.length} onClick={() => go({ kind: 'move', classId: cls }, canMove, 'Move to this class?')}>
            Move ({canMove.length})
          </button>
          <button className="btn-secondary" disabled={busy || !canDeactivate.length} onClick={() => go({ kind: 'deactivate' }, canDeactivate, 'Deactivate these people?', true)}>
            Deactivate ({canDeactivate.length})
          </button>
          <button className="btn-secondary" disabled={busy || !canReactivate.length} onClick={() => go({ kind: 'reactivate' }, canReactivate, 'Reactivate these people?')}>
            Reactivate ({canReactivate.length})
          </button>
          <button
            className="btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (await del(selected)) clear();
              setBusy(false);
            }}
          >
            Delete ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export function Students() {
  const { actor, profile } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const everyone = useMemo(() => users.data.filter((u) => u.id !== profile.id), [users.data, profile.id]);
  if (users.loading || classes.loading) return <Spinner />;
  const q = filter.trim().toLowerCase();
  const list = everyone.filter((u) => !q || (u.name ?? '').toLowerCase().includes(q));
  const pending = list.filter((u) => u.status === 'pending');
  const active = list.filter((u) => u.status === 'active');
  const other = list.filter((u) => u.status === 'inactive' || u.status === 'rejected');
  const noClass = active.filter((u) => !u.classId || !classes.data.some((c) => c.id === u.classId));
  // Only keep selections that still exist (someone may have been deleted meanwhile)
  const selected = everyone.filter((u) => sel.has(u.id));
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = (group: UserProfile[]) =>
    setSel((p) => {
      const n = new Set(p);
      const all = group.every((u) => n.has(u.id));
      group.forEach((u) => (all ? n.delete(u.id) : n.add(u.id)));
      return n;
    });

  const rows = (group: UserProfile[]) => (
    <ul className="flex flex-col gap-2">
      {group.map((u) => (
        <UserRow key={u.id} u={u} classes={classes.data} actor={actor} selected={sel.has(u.id)} onToggle={() => toggle(u.id)} />
      ))}
    </ul>
  );
  const title = (text: string, group: UserProfile[]) => (
    <div className="mb-2 flex items-center justify-between">
      <div className="section-title mb-0" dir="auto">
        {text}
      </div>
      {group.length > 0 && (
        <button className="btn-ghost min-h-11 px-3 text-sm" onClick={() => toggleAll(group)}>
          {group.every((u) => sel.has(u.id)) ? 'Unselect all' : 'Select all'}
        </button>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col gap-5 ${selected.length ? 'pb-56' : ''}`}>
      <input className="input" placeholder="Search name" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {users.error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load students: {users.error.message}</div>}
      {classes.data.length === 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Create a class first (<Link className="underline" to="/admin/classes">Classes</Link>) — students must be assigned to one when approved.
        </div>
      )}
      <section>
        {title(`Waiting for approval (${pending.length})`, pending)}
        {pending.length === 0 ? <EmptyState>No pending sign-ups.</EmptyState> : rows(pending)}
      </section>
      {classes.data.map((c) => {
        const members = active.filter((u) => u.classId === c.id);
        if (!members.length) return null;
        return (
          <section key={c.id}>
            {title(`${c.name} (${members.length})`, members)}
            {rows(members)}
          </section>
        );
      })}
      {noClass.length > 0 && (
        <section>
          {title(`Active, no class (${noClass.length})`, noClass)}
          {rows(noClass)}
        </section>
      )}
      {other.length > 0 && (
        <section>
          {title(`Inactive / rejected (${other.length})`, other)}
          {rows(other)}
        </section>
      )}
      {q && list.length === 0 && <EmptyState>Nobody matches “{filter}”.</EmptyState>}
      {selected.length > 0 && <BulkBar selected={selected} users={everyone} classes={classes.data} actor={actor} clear={() => setSel(new Set())} />}
    </div>
  );
}
