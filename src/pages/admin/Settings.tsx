import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers } from '../../hooks/useAdminData';
import { saveSettings, transferAdmin } from '../../lib/db';
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
      <div className="section-title">Password sign-in for this admin account</div>
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
        <input className="input" type="text" placeholder={hasPassword ? 'New password' : 'Choose a password (6+ characters)'} minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoCapitalize="off" autoCorrect="off" required />
        <button className="btn-primary shrink-0 px-4" disabled={busy || pw.length < 6}>
          {hasPassword ? 'Change' : 'Set'}
        </button>
      </form>
      {hasPassword && (
        <button className="btn-secondary mt-2 w-full" disabled={busy} onClick={() => act(removePassword, 'Password sign-in removed.')}>
          Remove password sign-in
        </button>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-brand-700' : 'text-red-600'}`}>{msg.text}</p>}
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
    <section className="card ring-2 ring-red-200">
      <div className="section-title text-red-700">Transfer admin</div>
      <p className="mb-3 text-sm text-slate-600">
        Hand the admin role to another approved user (e.g. the teacher). After transferring, <b>you will immediately lose access</b> to all
        student data in the app. This is recorded in the audit log and cannot be undone by you. See the README handover checklist — you
        must also change Google Cloud IAM.
      </p>
      <select className="input mb-2" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choose an approved user…</option>
        {candidates.map((u) => (
          <option key={u.id} value={u.id}>
            {displayName(u)}
          </option>
        ))}
      </select>
      {t && (
        <>
          <label className="label">
            Type <b>TRANSFER</b> to confirm
          </label>
          <input className="input mb-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="off" autoCorrect="off" />
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
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
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
            .then(() => setSaved('Saved ✓'))
            .catch((err) => setSaved(`Error: ${(err as Error).message}`));
          if (!navigator.onLine) setSaved('Saved offline — will sync when online.');
        }}
      >
        <div className="section-title">App settings</div>
        <div>
          <label className="label">Project timezone (days run midnight-to-midnight here)</label>
          <input className="input" list="tzlist" value={s.timezone} onChange={(e) => set('timezone', e.target.value)} />
          <datalist id="tzlist">
            {TIMEZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <p className={`mt-1 text-xs ${tzOk ? 'text-slate-500' : 'text-red-600'}`}>
            {tzOk ? `${offsetLabel(s.timezone)} now. Changing this shifts which date "today" is for everyone.` : 'Unknown timezone'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Backfill window (days)</label>
            <input className="input" type="number" min={0} max={30} value={s.backfillDays} onChange={(e) => set('backfillDays', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Week starts on</label>
            <select className="input" value={s.weekStart} onChange={(e) => set('weekStart', Number(e.target.value))}>
              {WEEKDAY_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Attention threshold (%)</label>
            <input className="input" type="number" min={0} max={100} value={s.attentionThreshold} onChange={(e) => set('attentionThreshold', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Flag after no logs for (days)</label>
            <input className="input" type="number" min={1} max={60} value={s.attentionNoLogDays} onChange={(e) => set('attentionNoLogDays', Number(e.target.value))} />
          </div>
          <div className="col-span-2">
            <label className="label">Default reminder time</label>
            <input className="input" type="time" value={s.defaultReminderTime} onChange={(e) => e.target.value && set('defaultReminderTime', e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={!tzOk}>
          Save settings
        </button>
        {saved && <p className="text-sm text-slate-600">{saved}</p>}
      </form>

      <Link to="/admin/audit" className="card flex items-center justify-between">
        <span className="font-semibold">Audit log</span>
        <span aria-hidden>›</span>
      </Link>

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
