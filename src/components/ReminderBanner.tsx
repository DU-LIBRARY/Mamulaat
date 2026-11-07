import { Link } from 'react-router-dom';

export function ReminderBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gold-400/20 p-3 text-amber-900 ring-1 ring-gold-400/50">
      <span className="text-2xl" aria-hidden>
        🔔
      </span>
      <div className="flex-1 text-sm">
        <b>You haven't logged your mamoolaat today.</b> Tap each one below — it only takes a moment.
      </div>
      <Link to="/me" className="text-xs font-semibold underline">
        Reminders
      </Link>
    </div>
  );
}
