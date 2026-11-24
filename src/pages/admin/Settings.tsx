import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useAllUsers } from '../../hooks/useAdminData';
import { saveSettings, setAssistant, transferAdmin } from '../../lib/db';
import { useDialog } from '../../components/Dialog';
import { pushSupportMessage, reminderSchedule } from '../../lib/messaging';
import { useDeviceNotifications } from '../../hooks/useDeviceNotifications';
import { Notice } from '../../components/ui';
import { WEEKDAY_NAMES, isValidTimezone, utcOffsetMinutes } from '../../lib/dates';
import type { AppSettings } from '../../types';
import { ThemePicker } from '../../components/ThemePicker';
import { InstallApp } from '../../components/InstallApp';
import { isIOS, isStandalone } from '../../lib/pwa';
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
  const { profile, user, hasPassword, setPassword, removePassword } = useActiveSession();
  const [pw, setPw] = useState('');
  const [current, setCurrent] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Without Google on the account, the current password is the only way to prove it's them.
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  const needCurrent = hasPassword && !hasGoogle;
  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setPw('');
      setCurrent('');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2 className="section-title">{hasPassword ? 'Change password' : 'Password sign-in for this account'}</h2>
      <p className="mb-3 text-sm text-slate-600">
        Sign in without Google: on the sign-in screen tap “Use email and password instead” and use <b>{profile.email}</b> with this password. Anyone with it has full admin access.
      </p>
      <p className="mb-2 text-sm">
        Status: {hasPassword ? <b className="text-brand-700">password sign-in is ON</b> : <b className="text-slate-500">off</b>}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => setPassword(pw, hasPassword ? current : undefined), hasPassword ? 'Password changed.' : 'Password sign-in turned on.');
        }}
      >
        {hasPassword && (
          <input
            className="input"
            type={show ? 'text' : 'password'}
            aria-label="Current password"
            placeholder={needCurrent ? 'Current password' : 'Current password (or confirm with Google)'}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required={needCurrent}
          />
        )}
        <div className="flex gap-2">
          <input
            className="input"
            type={show ? 'text' : 'password'}
            aria-label={hasPassword ? 'New password' : 'Password'}
            placeholder={hasPassword ? 'New password (6+ characters)' : 'Choose a password (6+ characters)'}
            autoComplete="new-password"
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            required
          />
          <button className="btn-primary shrink-0 px-4" disabled={busy || pw.length < 6 || (needCurrent && !current)}>
            {hasPassword ? 'Change' : 'Set'}
          </button>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
        </label>
      </form>
      {hasPassword && hasGoogle && (
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
  const { on, busy, msg, support, toggle, test } = useDeviceNotifications(profile);
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
          className={`relative h-7 w-12 shrink-0 rounded-full before:absolute before:inset-x-0 before:-inset-y-2 transition-colors duration-300 ease-calm ${on ? 'bg-primary' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-calm ${on ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      {on && (
        <button type="button" className="btn-secondary mt-3 w-full" onClick={test}>
          Send a test notification
        </button>
      )}
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
      {isIOS() && !isStandalone() && (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <b className="font-medium text-slate-900">iPhone / iPad:</b> notifications only work in the Home Screen app. In Safari tap Share →{' '}
          <i>Add to Home Screen</i> (iOS 16.4 or later), open Mamūlāt from that icon, then turn this on there.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">Students with reminders on are reminded to log: {reminderSchedule().toLowerCase()}. Students are notified automatically when you approve them, if they turned on notifications while waiting.</p>
    </section>
  );
}

/** The admin chooses who is a limited admin: listed here, added from a student's Profile tab. */
function LimitedAdmins() {
  const { actor } = useActiveSession();
  const users = useAllUsers();
  const { confirm } = useDialog();
  const [err, setErr] = useState<string | null>(null);
  const list = users.data.filter((u) => u.role === 'assistant');
  return (
    <section className="card">
      <h2 className="section-title">Limited admins</h2>
      <p className="mb-3 text-sm text-slate-600">
        A limited admin can approve and manage students, classes and settings and leave notes, but can't see anyone's mamoolaat, logs or salah, delete a student or hand out roles. To add one, open
        an approved person under Students → Profile → “Make limited admin”.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Nobody yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {list.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-slate-900" dir="auto">
                  {displayName(u)}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {u.email}
                  {u.status !== 'active' ? ` · ${u.status}` : ''}
                </span>
              </span>
              <button
                className="btn-ghost min-h-11 shrink-0 px-3 text-sm text-red-700"
                onClick={async () => {
                  const ok = await confirm({ title: `Remove ${displayName(u)} as limited admin?`, message: 'They become an ordinary student with no class. Move them into a class, or deactivate them, under Students.', confirmLabel: 'Remove', danger: true });
                  if (ok) setAssistant(u.id, false, actor).then(() => setErr(null), (e) => setErr((e as Error).message));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
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
  const { settings, settingsLoaded, actor, limited } = useActiveSession();
  const [s, setS] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => setS(settings), [settings]);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const tzOk = isValidTimezone(s.timezone);

  return (
    <div className="flex flex-col gap-4">
      <AdminNotifications />

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
          <div className="col-span-2">
            <label className="label" htmlFor="set-fajr">Fajr report time</label>
            <input id="set-fajr" className="input" type="time" value={s.fajrReportTime} onChange={(e) => e.target.value && set('fajrReportTime', e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">When each class's Fajr monitor gets the day's Fajr summary on their phone. Set it after Fajr ends.</p>
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

      <InstallApp />

      <ThemePicker />
      <PasswordSignIn />
      {!limited && <LimitedAdmins />}
      {!limited && <TransferAdmin />}

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
