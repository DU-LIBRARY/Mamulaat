import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useDocData } from '../../hooks/useFirestore';
import { classesCol } from '../../lib/db';
import { doc } from 'firebase/firestore';
import { pushSupportMessage, reminderSchedule } from '../../lib/messaging';
import { useDeviceNotifications } from '../../hooks/useDeviceNotifications';
import { isIOS, isStandalone } from '../../lib/pwa';
import type { ClassDoc } from '../../types';
import { IconChevronRight } from '../../components/icons';
import { BlankAvatar, Notice } from '../../components/ui';
import { ThemePicker } from '../../components/ThemePicker';
import { InstallApp } from '../../components/InstallApp';
import { useDialog } from '../../components/Dialog';
import { useSyncState } from '../../lib/sync';
import { useLoadFrom, useMyData } from '../../hooks/useStudentData';
import { YearSummary } from '../../components/YearChart';

export function Me() {
  const { profile, settings, signOut, today } = useActiveSession();
  const mine = useMyData();
  useLoadFrom(mine, `${today.slice(0, 4)}-01-01`); // the year chart
  const sync = useSyncState();
  const { confirm } = useDialog();
  const cls = useDocData<ClassDoc>(profile.classId ? doc(classesCol(), profile.classId) : null, `class:${profile.classId}`);
  const { on, busy, msg, support, toggle, test } = useDeviceNotifications(profile);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 pt-5 pb-2">
        <BlankAvatar size={56} />
        <div className="min-w-0">
          <div className="font-serif text-[28px] leading-tight text-slate-900" dir="auto">
            {profile.name}
          </div>
          <div className="truncate text-sm text-slate-500">{profile.email}</div>
          {cls.data && <div className="text-sm text-slate-600" dir="auto">Class: {cls.data.name}</div>}
        </div>
      </div>

      <YearSummary today={today} weekStart={settings.weekStart} logs={mine.logs} mamoolaat={mine.all} salah={mine.salah} />

      <section className="card">
        <h2 className="section-title">My name</h2>
        <p className="text-slate-900" dir="auto">
          {profile.name ?? profile.email}
        </p>
        <p className="mt-1 text-sm text-slate-500">If your name is wrong, ask your teacher to change it.</p>
      </section>

      <Link to="/mamoolaat" className="card group flex items-center justify-between pb-5">
        <span>
          <span className="block text-slate-900">My mamoolaat</span>
          <span className="text-sm text-slate-500">Add, edit, reorder or remove</span>
        </span>
        <IconChevronRight size={18} className="text-slate-400" />
      </Link>

      <section className="card">
        <h2 className="section-title">Daily reminder</h2>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="text-slate-900">Remind me on this device</span>
            <span className="block text-sm text-slate-500">{reminderSchedule()} ({settings.timezone} time)</span>
          </span>
          <button
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full before:absolute before:inset-x-0 before:-inset-y-2 transition-colors duration-300 ease-calm ${on ? 'bg-primary' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-calm ${on ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>
        {on && (
          <button type="button" className="btn-secondary mt-3 w-full" onClick={test}>
            Send a test notification
          </button>
        )}
        {msg && <div className="mt-3"><Notice>{msg}</Notice></div>}
        {support && !support.ok && !msg && (on || support.reason === 'denied') && (
          <div className="mt-3"><Notice>{pushSupportMessage[support.reason]}</Notice></div>
        )}
        {isIOS() && (
          <p className="mt-3 rounded-lg bg-surface p-3.5 text-sm leading-relaxed text-slate-700">
            <b className="font-medium text-slate-900">iPhone / iPad:</b> push reminders only work after you add Mamūlāt to your Home Screen (tap Share →{' '}
            <i>Add to Home Screen</i>) on iOS 16.4 or later, then open it from the Home Screen icon and turn reminders on
            there.{isStandalone() ? ' You are using the Home Screen app.' : ''}
          </p>
        )}
      </section>

      <InstallApp />

      <ThemePicker />

      <button
        className="min-h-11 self-start text-[15px] text-brand-700 hover:text-brand-900"
        onClick={async () => {
          if (sync.pending > 0 && !sync.online) {
            const ok = await confirm({
              title: 'Sign out while offline?',
              message: 'Some of your changes are only saved on this phone and haven’t uploaded yet. Signing out now deletes them. Connect to the internet first to keep them.',
              confirmLabel: 'Sign out anyway',
              danger: true,
            });
            if (!ok) return;
          }
          signOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
