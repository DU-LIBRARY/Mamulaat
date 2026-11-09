import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useDocData } from '../../hooks/useFirestore';
import { classesCol, updateOwnProfile } from '../../lib/db';
import { doc } from 'firebase/firestore';
import { PrivacyNote } from '../../components/PrivacyNote';
import { pushSupport, pushSupportMessage, reminderSchedule, registerDevice, unregisterDevice, type PushSupport } from '../../lib/messaging';
import { isIOS, isStandalone } from '../../lib/pwa';
import type { ClassDoc } from '../../types';
import { IconChevronRight } from '../../components/icons';
import { Notice } from '../../components/ui';
import { ThemePicker } from '../../components/ThemePicker';
import { InstallApp } from '../../components/InstallApp';

export function Me() {
  const { profile, settings, signOut } = useActiveSession();
  const cls = useDocData<ClassDoc>(profile.classId ? doc(classesCol(), profile.classId) : null, `class:${profile.classId}`);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState(profile.name ?? '');
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === profile.name) return;
    updateOwnProfile(profile.id, { name: n.slice(0, 100) });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

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
    updateOwnProfile(profile.id, { reminderEnabled: true });
    if (!res.ok) setMsg(pushSupportMessage[res.reason]);
    else setMsg('Reminders are on for this device.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 pt-5 pb-2">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 font-serif text-2xl text-brand-800" aria-hidden>{(profile.name ?? '?').trim().charAt(0).toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <div className="font-serif text-[30px] leading-tight text-slate-900" dir="auto">
            {profile.name}
          </div>
          <div className="truncate text-sm text-slate-500">{profile.email}</div>
          {cls.data && <div className="text-sm text-slate-600" dir="auto">Class: {cls.data.name}</div>}
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">My name</h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} aria-label="Your name" />
          <button className="btn-secondary" type="submit" disabled={!name.trim() || name.trim() === profile.name}>
            {nameSaved ? 'Saved' : 'Save'}
          </button>
        </form>
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
            <span className="text-slate-900">Remind me to log</span>
            <span className="block text-sm text-slate-500">{reminderSchedule()} ({settings.timezone} time)</span>
          </span>
          <button
            role="switch"
            aria-checked={profile.reminderEnabled}
            disabled={busy}
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ease-calm ${profile.reminderEnabled ? 'bg-primary' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-calm ${profile.reminderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>
        {msg && <div className="mt-3"><Notice>{msg}</Notice></div>}
        {support && !support.ok && !msg && profile.reminderEnabled && (
          <div className="mt-3"><Notice>{pushSupportMessage[support.reason]}</Notice></div>
        )}
        {isIOS() && (
          <p className="mt-3 rounded-lg bg-surface p-3.5 text-sm leading-relaxed text-slate-700">
            <b className="font-medium text-slate-900">iPhone / iPad:</b> push reminders only work after you add Mamūlāt to your Home Screen (tap Share →{' '}
            <i>Add to Home Screen</i>) on iOS 16.4 or later, then open it from the Home Screen icon and turn reminders on
            there.{isStandalone() ? ' You are using the Home Screen app.' : ''}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          If notifications aren't available, you'll still see a reminder banner when you open the app and haven't logged.
        </p>
      </section>

      <InstallApp />

      <ThemePicker />

      <PrivacyNote />

      <button className="min-h-11 self-start text-[15px] text-brand-700 hover:text-brand-900" onClick={() => signOut()}>
        Sign out
      </button>
      <p className="-mt-4 text-xs text-slate-500">
        Signing out on this device removes offline access until you sign in again.
      </p>
    </div>
  );
}
