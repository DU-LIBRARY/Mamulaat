import { limit, query } from 'firebase/firestore';
import { useCollectionData } from '../../hooks/useFirestore';
import { auditQuery } from '../../lib/db';
import { useAllUsers } from '../../hooks/useAdminData';
import { EmptyState, Spinner } from '../../components/ui';
import type { AuditEntry } from '../../types';
import { displayName } from '../../lib/display';

export function Audit() {
  const log = useCollectionData<AuditEntry>(query(auditQuery(), limit(300)), 'audit');
  const users = useAllUsers();
  const name = (id: unknown) => {
    const u = users.data.find((x) => x.id === id);
    return u ? (displayName(u)) : String(id ?? '');
  };
  if (log.loading) return <Spinner />;
  if (!log.data.length) return <EmptyState>No audit entries yet.</EmptyState>;
  return (
    <ul className="flex flex-col gap-2">
      {log.data.map((e) => {
        const d = e.details ?? {};
        // Older entries recorded emails; never show them.
        const shown = Object.fromEntries(Object.entries(d).filter(([k]) => !/email/i.test(k)));
        const subject = d.studentId ?? d.userId ?? d.to;
        return (
          <li key={e.id} className="card p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-mono font-semibold text-brand-700">{e.action}</span>
              <span className="text-xs text-slate-500">{e.createdAt ? e.createdAt.toDate().toLocaleString() : 'pending'}</span>
            </div>
            <div className="text-slate-600">
              by {e.actorName ?? name(e.actorId)}
              {subject ? ` · ${name(subject)}` : ''}
            </div>
            <details className="mt-1 text-xs text-slate-500">
              <summary className="cursor-pointer">details</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(shown, null, 2)}</pre>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
