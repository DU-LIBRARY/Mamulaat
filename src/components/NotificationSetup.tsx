import { useEffect, useState } from 'react';
import {
  deviceHasPush,
  pushSupport,
  pushSupportMessage,
  registerDevice,
  sendTestNotification,
  type PushSupport,
} from '../lib/messaging';
import { updateOwnProfile } from '../lib/db';
import { Notice } from './ui';
import { IconBell, IconX } from './icons';

/** This device's push state, shared by the student "Me" page, the Home prompt and admin Settings. */
export function useDevicePush(uid: string) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [deviceOn, setDeviceOn] = useState(deviceHasPush);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    pushSupport().then((s) => live && setSupport(s));
    return () => {
      live = false;
    };
  }, []);
  /** Ask permission (needs a tap) and register this device. */
  const enable = async () => {
    setBusy(true);
    const res = await registerDevice(uid);
    setBusy(false);
    setSupport(res.ok ? { ok: true } : res);
    setDeviceOn(res.ok);
    return res;
  };
  return { support, deviceOn, setDeviceOn, busy, enable };
}

/** "Send a test notification" button with its result message. */
export function TestNotificationButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-3">
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          setMsg(await sendTestNotification());
          setBusy(false);
        }}
      >
        {busy ? 'Sending…' : 'Send a test notification'}
      </button>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-brand-700' : 'text-slate-700'}`}>{msg.text}</p>}
    </div>
  );
}

const DISMISS_KEY = 'mamulaat.notifPromptDismissed';

/**
 * Prompt on the student's Today page: offer to turn on reminder notifications when this
 * device isn't receiving them. Dismissable (remembered per device for 14 days).
 */
export function NotificationPrompt({ uid, reminderEnabled, reminderTime }: { uid: string; reminderEnabled: boolean; reminderTime: string }) {
  const { support, deviceOn, busy, enable } = useDevicePush(uid);
  const [msg, setMsg] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      return Date.now() - t < 14 * 86400000;
    } catch {
      return false;
    }
  });
  if (hidden || deviceOn || !support) return null;
  const iosNeedsInstall = !support.ok && support.reason === 'ios-not-installed';
  // Nothing the student can do here (no push in this browser / not configured).
  if (!support.ok && !iosNeedsInstall && support.reason !== 'denied') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };

  return (
    <Notice
      tone="info"
      icon={<IconBell size={18} />}
      action={
        <button className="btn min-h-9 px-1.5 opacity-70 hover:opacity-100" onClick={dismiss} aria-label="Not now">
          <IconX size={16} />
        </button>
      }
    >
      <span className="font-medium">Get a reminder notification</span>
      {iosNeedsInstall ? (
        <span className="block">
          On iPhone/iPad, first add Mamulaat to your Home Screen (tap Share → <i>Add to Home Screen</i>), then open it from the Home Screen icon and
          turn reminders on.
        </span>
      ) : support.ok ? (
        <>
          <span className="block">We'll notify you at {reminderTime} if you haven't logged yet.</span>
          <button
            className="btn-primary mt-2 min-h-9"
            disabled={busy}
            onClick={async () => {
              setMsg(null);
              const res = await enable();
              if (res.ok) {
                if (!reminderEnabled) updateOwnProfile(uid, { reminderEnabled: true, reminderTime });
              } else setMsg(pushSupportMessage[res.reason]);
            }}
          >
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      ) : (
        <span className="block">{pushSupportMessage[support.reason]}</span>
      )}
      {msg && <span className="mt-2 block">{msg}</span>}
    </Notice>
  );
}

/** Per-device status under a notifications switch: "not on for this device" + fix button, or a test button. */
export function DevicePushStatus({ on, push, onEnabled }: { on: boolean; push: ReturnType<typeof useDevicePush>; onEnabled?: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const { support, deviceOn, busy, enable } = push;
  if (!on || !support) return null;
  if (deviceOn) return <TestNotificationButton />;
  return (
    <div className="mt-3">
      <Notice tone="warn">
        <span className="font-medium">Not receiving notifications on this device.</span>{' '}
        {support.ok ? 'Tap below to turn them on here too.' : pushSupportMessage[support.reason]}
      </Notice>
      {support.ok && (
        <button
          className="btn-secondary mt-2"
          disabled={busy}
          onClick={async () => {
            setMsg(null);
            const res = await enable();
            if (res.ok) onEnabled?.();
            else setMsg(pushSupportMessage[res.reason]);
          }}
        >
          {busy ? 'Turning on…' : 'Turn on for this device'}
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
