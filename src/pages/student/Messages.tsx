import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { markChangeSeen, markCommentRead } from '../../lib/db';
import { EmptyState } from '../../components/ui';
import type { ChangeRecord } from '../../types';
import { targetLabel } from '../../components/Checklist';

function when(ts?: { toDate(): Date } | null) {
  return ts ? ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
}

export function describeChange(c: ChangeRecord) {
  if (c.kind === 'added') return `Added "${c.mamoolName}"${c.after ? ` (${targetLabel(c.after as { target: number; unit: string })})` : ''}`;
  if (c.kind === 'removed') return `Removed "${c.mamoolName}"`;
  const parts: string[] = [];
  if (c.before?.name !== c.after?.name) parts.push(`renamed "${c.before?.name}" → "${c.after?.name}"`);
  if (c.before?.target !== c.after?.target || c.before?.unit !== c.after?.unit)
    parts.push(
      `target ${targetLabel(c.before as { target: number; unit: string })} → ${targetLabel(c.after as { target: number; unit: string })}`,
    );
  return `Changed "${c.mamoolName}": ${parts.join(', ') || 'updated'}`;
}

export function Messages() {
  const { profile } = useActiveSession();
  const { comments, changes } = useMyData();
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="section-title">Comments from your teacher</div>
        {comments.length === 0 ? (
          <EmptyState>No comments yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <li key={c.id} className={`card ${c.readAt ? '' : 'ring-2 ring-gold-400/60'}`}>
                <p className="whitespace-pre-wrap" dir="auto">
                  {c.text}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {c.authorName} · {when(c.createdAt)}
                  </span>
                  {c.readAt ? (
                    <span>✓ Read</span>
                  ) : (
                    <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => markCommentRead(profile.id, c.id)}>
                      Mark as read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="section-title">Changes to your mamoolaat</div>
        {changes.length === 0 ? (
          <EmptyState>Your teacher hasn't changed your list.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li key={c.id} className={`card ${c.seenAt ? '' : 'ring-2 ring-gold-400/60'}`}>
                <div dir="auto">{describeChange(c)}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    by {c.actorName} · {when(c.createdAt)}
                  </span>
                  {c.seenAt ? (
                    <span>✓ Seen</span>
                  ) : (
                    <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => markChangeSeen(profile.id, c.id)}>
                      Got it
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
