import { useEffect, useState } from 'react';
import { useActiveSession } from '../../hooks/useSession';
import { useDocData } from '../../hooks/useFirestore';
import { classesCol, updateOwnProfile } from '../../lib/db';
import { doc } from 'firebase/firestore';
import { PrivacyNote } from '../../components/PrivacyNote';
import { pushSupport, pushSupportMessage, registerDevice, unregisterDevice, type PushSupport } from '../../lib/messaging';
import { isIOS, isStandalone } from '../../lib/pwa';
import type { ClassDoc } from '../../types';

export function Me() {
  const { profile, settings, signOut } = useActiveSession();
  const cls = useDocData<ClassDoc>(profile.classId ? doc(classesCol(), profile.classId) : null, `class:${profile.classId}`);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const time = profile.reminderTime ?? settings.defaultReminderTime;

  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);

  const toggle = async () => {
    setMsg(null);
    if (profile.reminderEnabled) {
      updateOwnProfile(profile.id, { reminderEnabled: false });
      await unregisterDevice(profile.id);
      return;
    }
    setBusy(true);
    const res = await registerDevice(profile.id);
    setBusy(false);
    setSupport(res.ok ? { ok: true } : res);
    // Even without push, keep the preference so the in-app banner/time are remembered.
    updateOwnProfile(profile.id, { reminderEnabled: true, reminderTime: time });
    if (!res.ok) setMsg(pushSupportMessage[res.reason]);
    else setMsg('Reminders are on for this device.');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-3">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-14 w-14 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">🙂</div>
        )}
        <div className="min-w-0">
          <div className="text-lg font-bold" dir="auto">
            {profile.name}
          </div>
          <div className="truncate text-sm text-slate-500">{profile.email}</div>
          {cls.data && <div className="text-sm text-slate-600" dir="auto">Class: {cls.data.name}</div>}
        </div>
      </div>

      <section className="card">
        <div className="section-title">Daily reminder</div>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="font-semibold">Remind me if I haven't logged</span>
            <span className="block text-sm text-slate-500">Time zone: {settings.timezone}</span>
          </span>
          <button
            role="switch"
            aria-checked={profile.reminderEnabled}
            disabled={busy}
            onClick={toggle}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${profile.reminderEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${profile.reminderEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </label>
        <div className="mt-3">
          <label className="label" htmlFor="rtime">
            Reminder time
          </label>
          <input
            id="rtime"
            type="time"
            className="input"
            value={time}
            onChange={(e) => e.target.value && updateOwnProfile(profile.id, { reminderTime: e.target.value })}
          />
        </div>
        {msg && <p className="mt-3 rounded-xl bg-sand-50 p-3 text-sm text-slate-700">{msg}</p>}
        {support && !support.ok && !msg && profile.reminderEnabled && (
          <p className="mt-3 rounded-xl bg-sand-50 p-3 text-sm text-slate-700">{pushSupportMessage[support.reason]}</p>
        )}
        {isIOS() && (
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            📱 <b>iPhone / iPad:</b> push reminders only work after you add Mamulaat to your Home Screen (tap Share →{' '}
            <i>Add to Home Screen</i>) on iOS 16.4 or later, then open it from the Home Screen icon and turn reminders on
            there.{isStandalone() ? ' ✓ You are using the Home Screen app.' : ''}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          If notifications aren't available, you'll still see a reminder banner when you open the app and haven't logged.
        </p>
      </section>

      <PrivacyNote />

      <button className="btn-secondary" onClick={() => signOut()}>
        Sign out
      </button>
      <p className="text-center text-xs text-slate-400">
        Signing out on this device removes offline access until you sign in again.
      </p>
    </div>
  );
}
