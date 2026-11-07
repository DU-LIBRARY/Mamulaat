export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl bg-brand-50 text-sm text-brand-900 ring-1 ring-brand-100 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-1 font-bold">🔒 Who can see what</div>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your mamoolaat, daily logs, progress and streaks are visible only to <b>you</b> and the <b>admin (your teacher)</b>.</li>
        <li>Other students can never see your data, and there are no leaderboards.</li>
        <li>We store only your name, email and photo from Google sign-in, plus the mamoolaat you enter.</li>
        <li>The admin can delete your account and all your data on request.</li>
        <li>People who manage the app's Google Cloud project could technically access stored data; access is limited to the school.</li>
      </ul>
    </div>
  );
}
