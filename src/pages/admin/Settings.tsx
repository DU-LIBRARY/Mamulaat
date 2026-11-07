import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers } from '../../hooks/useAdminData';
import { saveSettings, transferAdmin, updateOwnProfile } from '../../lib/db';
import { pushSupport, pushSupportMessage, registerDevice, unregisterDevice, type PushSupport } from '../../lib/messaging';
import { Notice } from '../../components/ui';
import { WEEKDAY_NAMES, isValidTimezone, utcOffsetMinutes } from '../../lib/dates';
import type { AppSettings } from '../../types';
import { displayName } from '../../lib/display';

const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
})();

function offsetLabel(tz: string) {
  const o = utcOffsetMinutes(tz);
  const s = o >= 0 ? '+' : '-';
  const a = Math.abs(o);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function PasswordSignIn() {
  const { profile, hasPassword, setPassword, removePassword } = useActiveSession();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setPw('');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2 className="section-title">Password sign-in for this admin account</h2>
      <p className="mb-3 text-sm text-slate-600">
        Lets someone (e.g. the teacher) open this admin account without Google: on the sign-in screen they tap “Sign in with email &amp; password” and use{' '}
        <b>{profile.email}</b> with the password below. Anyone with it has full admin access — remove it when no longer needed.
      </p>
      <p className="mb-2 text-sm">
        Status: {hasPassword ? <b className="text-brand-700">password sign-in is ON</b> : <b className="text-slate-500">off</b>}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => setPassword(pw), hasPassword ? 'Password changed.' : 'Password sign-in turned on.');
        }}
      >
        <input className="input" type="text" aria-label="Password" placeholder={hasPassword ? 'New password' : 'Choose a password (6+ characters)'} minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoCapitalize="off" autoCorrect="off" required />
        <button className="btn-primary shrink-0 px-4" disabled={busy || pw.length < 6}>
          {hasPassword ? 'Change' : 'Set'}
        </button>
      </form>
      {hasPassword && (
        <button className="btn-secondary mt-2 w-full" disabled={busy} onClick={() => act(removePassword, 'Password sign-in removed.')}>
          Remove password sign-in
        </button>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-brand-700' : 'text-red-700'}`}>{msg.text}</p>}
    </section>
  );
}

/** Lets the admin get a push on this device when someone finishes signing up. */
function AdminNotifications() {
  const { profile } = useActiveSession();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);
  const on = !!profile.reminderEnabled;
  const toggle = async () => {
    setMsg(null);
    if (on) {
      updateOwnProfile(profile.id, { reminderEnabled: false });
      await unregisterDevice(profile.id);
      return;
    }
    setBusy(true);
    const res = await registerDevice(profile.id);
    setBusy(false);
    setSupport(res.ok ? { ok: true } : res);
    if (res.ok) {
      updateOwnProfile(profile.id, { reminderEnabled: true });
      setMsg('Notifications are on for this device.');
    } else setMsg(pushSupportMessage[res.reason]);
  };
  return (
    <section className="card">
      <h2 className="section-title">Notifications</h2>
      <div className="flex min-h-12 items-center justify-between gap-3">
        <span id="admin-notif-label">
          <span className="font-medium text-slate-900">Tell me when someone signs up</span>
          <span className="block text-sm text-slate-500">A notification on this device when a new student is waiting for approval.</span>
        </span>
        <button
          role="switch"
          aria-checked={on}
          aria-labelledby="admin-notif-label"
          disabled={busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-700' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {msg && (
        <div className="mt-3">
          <Notice>{msg}</Notice>
        </div>
      )}
      {support && !support.ok && !msg && on && (
        <div className="mt-3">
          <Notice>{pushSupportMessage[support.reason]}</Notice>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Needs the reminder functions to be deployed (see the README). Students are notified automatically when you approve them, if they turned on notifications while waiting.</p>
    </section>
  );
}

function TransferAdmin() {
  const { actor, profile } = useActiveSession();
  const users = useAllUsers();
  const [target, setTarget] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const candidates = users.data.filter((u) => u.id !== profile.id && u.status === 'active');
  const t = candidates.find((u) => u.id === target);

  return (
    <section className="card border-red-200">
      <h2 className="section-title text-red-800">Transfer admin</h2>
      <p className="mb-3 text-sm text-slate-600">
        Hand the admin role to another approved user (e.g. the teacher). After transferring, <b>you will immediately lose access</b> to all
        student data in the app. This is recorded in the audit log and cannot be undone by you. See the README handover checklist — you
        must also change Google Cloud IAM.
      </p>
      <select className="input mb-2" aria-label="New admin" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choose an approved user…</option>
        {candidates.map((u) => (
          <option key={u.id} value={u.id}>
            {displayName(u)}
          </option>
        ))}
      </select>
      {t && (
        <>
          <label className="label" htmlFor="transfer-confirm">
            Type <b>TRANSFER</b> to confirm
          </label>
          <input id="transfer-confirm" className="input mb-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="off" autoCorrect="off" />
          <button
            className="btn-danger w-full"
            disabled={busy || confirmText.trim().toUpperCase() !== 'TRANSFER' || !navigator.onLine}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await transferAdmin(actor, t);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Transferring…' : `Make ${displayName(t)} the admin and remove my access`}
          </button>
          {!navigator.onLine && <p className="mt-2 text-sm text-amber-700">You must be online to transfer admin.</p>}
        </>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
    </section>
  );
}

export function AdminSettings() {
  const { settings, settingsLoaded, actor } = useActiveSession();
  const [s, setS] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => setS(settings), [settings]);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const tzOk = isValidTimezone(s.timezone);

  return (
    <div className="flex flex-col gap-4">
      {!settingsLoaded && <p className="text-sm text-slate-500">Loading settings…</p>}
      <form
        className="card flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!tzOk) return;
          setSaved('Saving…');
          saveSettings(s, actor)
            .then(() => setSaved('Saved'))
            .catch((err) => setSaved(`Error: ${(err as Error).message}`));
          if (!navigator.onLine) setSaved('Saved offline — will sync when online.');
        }}
      >
        <h2 className="section-title">App settings</h2>
        <div>
          <label className="label" htmlFor="set-tz">Project timezone (days run midnight-to-midnight here)</label>
          <input id="set-tz" className="input" list="tzlist" value={s.timezone} onChange={(e) => set('timezone', e.target.value)} />
          <datalist id="tzlist">
            {TIMEZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <p className={`mt-1 text-xs ${tzOk ? 'text-slate-500' : 'text-red-700'}`}>
            {tzOk ? `${offsetLabel(s.timezone)} now. Changing this shifts which date "today" is for everyone.` : 'Unknown timezone'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="set-backfill">Backfill window (days)</label>
            <input id="set-backfill" className="input" type="number" min={0} max={30} value={s.backfillDays} onChange={(e) => set('backfillDays', Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="set-week">Week starts on</label>
            <select id="set-week" className="input" value={s.weekStart} onChange={(e) => set('weekStart', Number(e.target.value))}>
              {WEEKDAY_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="set-threshold">Attention threshold (%)</label>
            <input id="set-threshold" className="input" type="number" min={0} max={100} value={s.attentionThreshold} onChange={(e) => set('attentionThreshold', Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="set-nolog">Flag after no logs for (days)</label>
            <input id="set-nolog" className="input" type="number" min={1} max={60} value={s.attentionNoLogDays} onChange={(e) => set('attentionNoLogDays', Number(e.target.value))} />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="set-reminder">Default reminder time</label>
            <input id="set-reminder" className="input" type="time" value={s.defaultReminderTime} onChange={(e) => e.target.value && set('defaultReminderTime', e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={!tzOk}>
          Save settings
        </button>
        {saved && (
          <p className="text-sm text-slate-600" role="status">
            {saved}
          </p>
        )}
      </form>

      <Link to="/admin/audit" className="card flex items-center justify-between">
        <span className="font-semibold">Audit log</span>
        <span aria-hidden>›</span>
      </Link>

      <AdminNotifications />
      <PasswordSignIn />
      <TransferAdmin />

      <SignOutButton />
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useActiveSession();
  return (
    <button className="btn-secondary w-full" onClick={() => signOut()}>
      Sign out
    </button>
  );
}
