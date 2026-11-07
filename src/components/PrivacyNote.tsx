export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl bg-brand-50 text-sm text-brand-900 ring-1 ring-brand-100 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-1 font-bold">🔒 Who can see what</div>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your mamoolaat, daily logs, progress and streaks are visible only to <b>you</b> and the <b>admin (the asaatidhah)</b>.</li>
        <li>Other students can never see your data.</li>
      </ul>
    </div>
  );
}
