import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { markChangeSeen, markCommentRead } from '../../lib/db';
import { Link } from 'react-router-dom';
import { EmptyState, Notice } from '../../components/ui';
import { findOverlaps } from '../../lib/names';
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
  const { comments, changes, active } = useMyData();
  const unseen = changes.filter((c) => !c.seenAt);
  const overlapCount = findOverlaps(active).size;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="section-title">Comments from your teacher</h2>
        {comments.length === 0 ? (
          <EmptyState>No comments yet.</EmptyState>
        ) : (
          <ul className="sheet">
            {comments.map((c) => (
              <li key={c.id} className={`px-4 py-3.5 ${c.readAt ? '' : 'bg-[#fbf6e9]'}`}>
                <p className="whitespace-pre-wrap text-slate-800" dir="auto">
                  {c.text}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {c.authorName} · {when(c.createdAt)}
                  </span>
                  {c.readAt ? (
                    <span>Read</span>
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
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="section-title mb-0">Changes to your mamoolaat</h2>
          {unseen.length > 1 && (
            <button className="link min-h-11" onClick={() => unseen.forEach((c) => markChangeSeen(profile.id, c.id))}>
              Mark all seen
            </button>
          )}
        </div>
        {unseen.some((c) => c.kind === 'added') && (
          <div className="mb-3">
            <Notice tone="teacher" action={<Link to="/mamoolaat" className="text-sm font-medium underline decoration-gold-400 underline-offset-4">My mamoolaat</Link>}>
              Your teacher added to your list. Your own mamoolaat are still there.
              {overlapCount > 0 ? ' Some look the same as ones you already had — remove or rename any doubles.' : ' You can reorder, edit or remove any of them.'}
            </Notice>
          </div>
        )}
        {changes.length === 0 ? (
          <EmptyState>Your teacher hasn't changed your list.</EmptyState>
        ) : (
          <ul className="sheet">
            {changes.map((c) => (
              <li key={c.id} className={`px-4 py-3.5 ${c.seenAt ? '' : 'bg-[#fbf6e9]'}`}>
                <div dir="auto">{describeChange(c)}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    by {c.actorName} · {when(c.createdAt)}
                  </span>
                  {c.seenAt ? (
                    <span>Seen</span>
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
