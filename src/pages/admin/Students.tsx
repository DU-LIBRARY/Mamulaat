import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers, useClasses, useStudentsRange } from '../../hooks/useAdminData';
import { applyTemplate, approveUser, bulkUpdateUsers, deactivateUser, deleteStudent, moveUser, reactivateUser, rejectUser, type Actor, type BulkAction } from '../../lib/db';
import { EmptyState, Spinner, cellClass } from '../../components/ui';
import { useDialog } from '../../components/Dialog';
import { IconCheck } from '../../components/icons';
import type { ClassDoc, UserProfile } from '../../types';
import { displayName } from '../../lib/display';
import { daysAgoLabel, diffDays, todayIn, weekDays, weekStartOf } from '../../lib/dates';
import { periodCompletion, pct } from '../../lib/scoring';

/** Approve, then add the class template (if any) to the student's own list. */
async function approveInto(uids: string[], cls: ClassDoc | undefined, classId: string, today: string, actor: Actor) {
  if (uids.length === 1) await approveUser(uids[0], classId, actor);
  else await bulkUpdateUsers(uids, { kind: 'approve', classId }, actor);
  if (cls?.template?.length) await applyTemplate(uids, cls.template, today, actor);
}

/** "Approve all into the class they asked for", grouped by class, with one confirmation. */
export function useApproveAll() {
  const { actor, today } = useActiveSession();
  const classes = useClasses();
  const { confirm, notify } = useDialog();
  return async (list: UserProfile[]) => {
    const ready = list.filter((u) => u.status === 'pending' && u.signupComplete && classes.data.some((c) => c.id === u.requestedClassId));
    if (!ready.length) return;
    const byClass = new Map<string, string[]>();
    ready.forEach((u) => byClass.set(u.requestedClassId!, [...(byClass.get(u.requestedClassId!) ?? []), u.id]));
    const ok = await confirm({
      title: `Approve ${ready.length} ${ready.length === 1 ? 'person' : 'people'}?`,
      message: (
        <ul className="list-disc pl-5">
          {[...byClass].map(([cid, ids]) => {
            const c = classes.data.find((x) => x.id === cid);
            return (
              <li key={cid} dir="auto">
                {ids.length} into {c?.name}
                {c?.template?.length ? ` (+ ${c.template.length} class mamoolaat)` : ''}
              </li>
            );
          })}
        </ul>
      ),
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    try {
      for (const [cid, ids] of byClass) await approveInto(ids, classes.data.find((c) => c.id === cid), cid, today, actor);
    } catch (e) {
      await notify('Could not approve everyone', (e as Error).message);
    }
  };
}

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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">{(displayName(u))[0]?.toUpperCase()}</div>
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

function UserRow({ u, classes, actor, selected, onToggle, week, today }: { u: UserProfile; classes: ClassDoc[]; actor: Actor; selected: boolean; onToggle: () => void; week?: number | null; today: string }) {
  const { confirm } = useDialog();
  const { settings } = useActiveSession();
  const tz = settings.timezone;
  const seen = lastSeenDays(u, today, tz);
  const del = useDeleteUsers(actor);
  const initial = u.classId ?? u.requestedClassId ?? '';
  const [cls, setCls] = useState(classes.some((c) => c.id === initial) ? initial : '');
  const [err, setErr] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setErr((e as Error).message));
  const requestedName = classes.find((c) => c.id === u.requestedClassId)?.name;
  return (
    <li className={`card flex flex-col gap-2 p-3 ${selected ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}>
      <div className="flex items-center gap-3">
        <label className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center">
          <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={selected} onChange={onToggle} aria-label={`Select ${displayName(u)}`} />
        </label>
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <Link to={`/admin/student/${u.id}`} className="block truncate font-semibold text-brand-700" dir="auto">
            {displayName(u)}
          </Link>
          {u.status === 'active' && (
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
              {week !== undefined && <span className={`chip num ${cellClass(week)}`}>{pct(week)} this week</span>}
              <span className={seen == null || seen >= STALE_DAYS ? 'text-amber-800' : ''}>Last opened: {daysAgoLabel(seen)}</span>
            </div>
          )}
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
          <button className="btn-primary" disabled={!cls} onClick={() => run(approveInto([u.id], classes.find((c) => c.id === cls), cls, today, actor))}>
            Approve
          </button>
          <button
            className="btn-ghost text-red-700"
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
              <button className="btn-secondary" disabled={!cls} onClick={() => run(approveInto([u.id], classes.find((c) => c.id === cls), cls, today, actor))}>
                Approve
              </button>
            </>
          )}
        </div>
      )}
      <div>
        <button className="btn-ghost min-h-11 px-2 text-sm text-red-700" onClick={() => del([u])}>
          Delete {u.status === 'active' ? 'student' : 'user'} and all data…
        </button>
      </div>
      {u.handedOverTo && <div className="text-xs text-slate-500">Former admin (handed over).</div>}
      {err && <div className="text-sm text-red-700">{err}</div>}
    </li>
  );
}

function BulkBar({ selected, users, classes, actor, clear, today }: { selected: UserProfile[]; users: UserProfile[]; classes: ClassDoc[]; actor: Actor; clear: () => void; today: string }) {
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
      if (action.kind === 'approve') await approveInto(uids, classes.find((c) => c.id === action.classId), action.classId, today, actor);
      else await bulkUpdateUsers(uids, action, actor);
      clear();
    } catch (e) {
      await notify('Could not finish', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="above-nav fixed inset-x-0 z-30 mx-auto max-w-3xl px-3 pb-2" role="region" aria-label="Actions for selected people">
      <div className="card flex flex-col gap-2 border-slate-300 shadow-lg">
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

const STALE_DAYS = 7;

/** Whole days since the student last opened the app (in the project timezone), or null if never. */
function lastSeenDays(u: UserProfile, today: string, tz: string): number | null {
  const ms = u.lastSeenAt?.toMillis?.();
  if (!ms) return null;
  return Math.max(0, diffDays(todayIn(tz, new Date(ms)), today));
}

type Sort = 'name' | 'week' | 'seen';

export function Students() {
  const { actor, profile, today, settings } = useActiveSession();
  const users = useAllUsers();
  const classes = useClasses();
  const approveAll = useApproveAll();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [staleOnly, setStaleOnly] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const tz = settings.timezone;

  const everyone = useMemo(() => users.data.filter((u) => u.id !== profile.id), [users.data, profile.id]);
  const activeIds = everyone.filter((u) => u.status === 'active' && u.role === 'student').map((u) => u.id);
  const days = weekDays(weekStartOf(today, settings.weekStart));
  const range = useStudentsRange(activeIds, days[0], today);
  const weekOf = (u: UserProfile) => {
    const r = range.get(u.id);
    return r?.loaded ? periodCompletion(days, r.logs, r.mamoolaat, today) : undefined;
  };

  if (users.loading || classes.loading) return <Spinner />;
  const q = filter.trim().toLowerCase();
  const isStale = (u: UserProfile) => {
    const d = lastSeenDays(u, today, tz);
    return d == null || d >= STALE_DAYS;
  };
  const list = everyone.filter((u) => (!q || (u.name ?? '').toLowerCase().includes(q)) && (!staleOnly || (u.status === 'active' && isStale(u))));
  const sorted = (g: UserProfile[]) => {
    if (sort === 'name') return g;
    const key = (u: UserProfile) => (sort === 'week' ? (weekOf(u) ?? -1) : -(lastSeenDays(u, today, tz) ?? 1e6));
    return [...g].sort((a, b) => key(a) - key(b));
  };
  const pending = list.filter((u) => u.status === 'pending');
  const active = list.filter((u) => u.status === 'active');
  const other = list.filter((u) => u.status === 'inactive' || u.status === 'rejected');
  const noClass = active.filter((u) => !u.classId || !classes.data.some((c) => c.id === u.classId));
  const staleCount = everyone.filter((u) => u.status === 'active' && isStale(u)).length;
  const readyToApprove = pending.filter((u) => u.signupComplete && classes.data.some((c) => c.id === u.requestedClassId));
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
      {sorted(group).map((u) => (
        <UserRow
          key={u.id}
          u={u}
          classes={classes.data}
          actor={actor}
          selected={sel.has(u.id)}
          onToggle={() => toggle(u.id)}
          week={u.status === 'active' ? weekOf(u) : undefined}
          today={today}
        />
      ))}
    </ul>
  );
  const title = (text: string, group: UserProfile[], extra?: ReactNode) => (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="section-title mb-0" dir="auto">
        {text}
      </h2>
      <div className="flex flex-wrap gap-2">
        {extra}
        {group.length > 0 && (
          <button className="btn-ghost min-h-11 px-3 text-sm" onClick={() => toggleAll(group)}>
            {group.every((u) => sel.has(u.id)) ? 'Unselect all' : 'Select all'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col gap-5 ${selected.length ? 'pb-56' : ''}`}>
      <div className="flex flex-col gap-2">
        <input className="input" type="search" placeholder="Search name" aria-label="Search students by name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Sort
            <select className="input min-h-9 w-auto py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="name">by name</option>
              <option value="week">lowest this week first</option>
              <option value="seen">longest since opened first</option>
            </select>
          </label>
          <button
            className={`btn min-h-9 border px-3 text-sm ${staleOnly ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`}
            aria-pressed={staleOnly}
            onClick={() => setStaleOnly((v) => !v)}
          >
            Not opened in {STALE_DAYS}+ days ({staleCount})
          </button>
        </div>
      </div>
      {users.error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load students: {users.error.message}</div>}
      {classes.data.length === 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Create a class first (<Link className="underline" to="/admin/classes">Classes</Link>) — students must be assigned to one when approved.
        </div>
      )}
      {!staleOnly && (
        <section>
          {title(
            `Waiting for approval (${pending.length})`,
            pending,
            readyToApprove.length > 0 && (
              <button className="btn-primary min-h-11 px-3 text-sm" onClick={() => approveAll(readyToApprove)}>
                <IconCheck size={16} />
                Approve {readyToApprove.length === pending.length ? 'all' : readyToApprove.length} as requested
              </button>
            ),
          )}
          {pending.length === 0 ? <EmptyState>No pending sign-ups.</EmptyState> : rows(pending)}
        </section>
      )}
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
      {(q || staleOnly) && list.length === 0 && <EmptyState>{staleOnly ? 'Everyone has opened the app recently.' : `Nobody matches “${filter}”.`}</EmptyState>}
      <p className="text-xs text-slate-500">“Last opened” is updated when a student opens the app (from this version on).</p>
      {selected.length > 0 && <BulkBar selected={selected} users={everyone} classes={classes.data} actor={actor} clear={() => setSel(new Set())} today={today} />}
    </div>
  );
}
