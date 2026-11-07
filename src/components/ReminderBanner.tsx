import { Link } from 'react-router-dom';
import { Notice } from './ui';
import { IconBell } from './icons';

export function ReminderBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Notice
      tone="warn"
      icon={<IconBell size={18} />}
      action={
        <Link to="/me" className="text-sm font-medium underline decoration-amber-400 underline-offset-4">
          Reminders
        </Link>
      }
    >
      <span className="font-medium">Nothing logged yet today.</span> Mark each mamool below as you go.
    </Notice>
  );
}
