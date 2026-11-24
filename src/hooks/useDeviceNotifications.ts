import { useEffect, useState } from 'react';
import { updateOwnProfile } from '../lib/db';
import { deviceNotificationsOn, pushSupport, pushSupportMessage, registerDevice, sendTestNotification, unregisterDevice, type PushSupport } from '../lib/messaging';
import type { UserProfile } from '../types';

/**
 * The notifications switch on the Me / Settings page. It is per device: turning it on or off here
 * changes only this phone. The account's `reminderEnabled` is kept as "on for at least one device"
 * (the admin's Remind page shows it).
 */
export function useDeviceNotifications(profile: Pick<UserProfile, 'id' | 'reminderEnabled'>) {
  const uid = profile.id;
  const [on, setOn] = useState(() => deviceNotificationsOn(uid));
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    pushSupport().then(setSupport);
    setOn(deviceNotificationsOn(uid));
  }, [uid]);

  const toggle = async () => {
    setMsg(null);
    setBusy(true);
    try {
      if (on) {
        const others = await unregisterDevice(uid);
        setOn(false);
        if (others === 0 && profile.reminderEnabled) updateOwnProfile(uid, { reminderEnabled: false });
        setMsg(others > 0 ? 'Notifications are off for this device. Your other devices still get them.' : null);
        return;
      }
      const res = await registerDevice(uid);
      setSupport(res.ok ? { ok: true } : res);
      if (res.ok) {
        setOn(true);
        if (!profile.reminderEnabled) updateOwnProfile(uid, { reminderEnabled: true });
        const shown = await sendTestNotification();
        setMsg(shown ? 'Notifications are on for this device. We sent a test notification: if it didn’t appear, check that notifications for this app are allowed and Do Not Disturb is off.' : 'Notifications are on for this device.');
      } else setMsg(pushSupportMessage[res.reason]);
    } finally {
      setBusy(false);
    }
  };

  /** Shows a test notification on this device, so the student can check they appear. */
  const test = async () => {
    const shown = await sendTestNotification();
    setMsg(shown ? 'Test sent. If it didn’t appear, check that notifications for this app are allowed and Do Not Disturb is off.' : 'Couldn’t show a test notification. Check that notifications are allowed for this app.');
  };

  return { on, busy, msg, support, toggle, test };
}
