import { useEffect, useState } from 'react';
import { updateOwnProfile } from '../lib/db';
import { deviceNotificationsOn, pushSupport, pushSupportMessage, registerDevice, unregisterDevice, type PushSupport } from '../lib/messaging';
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
        setMsg('Notifications are on for this device.');
      } else setMsg(pushSupportMessage[res.reason]);
    } finally {
      setBusy(false);
    }
  };

  return { on, busy, msg, support, toggle };
}
