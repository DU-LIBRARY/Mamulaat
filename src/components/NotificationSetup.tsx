import { useEffect, useState, type ReactNode } from 'react';
import { updateOwnProfile } from '../lib/db';
import {
  markNotificationSetup,
  notificationSetupDue,
  pushSupport,
  registerDevice,
  sendTestNotification,
  type PushSupport,
} from '../lib/messaging';
import { isAndroid, isIOS } from '../lib/pwa';
import type { UserProfile } from '../types';
import { IconBell } from './icons';

type Step = 'ask' | 'busy' | 'sent' | 'not-seen';

/**
 * Shown once per device when the app opens (after sign-up), before anything else: notifications
 * are how reminders reach students, so this walks them through turning them on, then sends a test
 * so they can see it works. "Not now" hides it for a few days. Renders `children` when not needed.
 */
export function NotificationSetup({
  profile,
  purpose,
  children,
}: {
  profile: Pick<UserProfile, 'id' | 'reminderEnabled'>;
  purpose: string;
  children: ReactNode;
}) {
  const uid = profile.id;
  const [due, setDue] = useState(() => notificationSetupDue(uid));
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [step, setStep] = useState<Step>('ask');

  useEffect(() => {
    if (due) pushSupport().then(setSupport);
  }, [due]);

  if (!due) return <>{children}</>;
  if (!support) return null; // a moment while we check what this device can do
  // Nothing the student can do on this device (old browser, local emulators, no push key).
  if (!support.ok && ['unsupported', 'emulator', 'no-vapid'].includes(support.reason)) return <>{children}</>;

  const finish = (state: 'done' | 'skipped') => {
    markNotificationSetup(uid, state);
    setDue(false);
  };

  const turnOn = async () => {
    setStep('busy');
    const res = await registerDevice(uid);
    setSupport(res);
    if (!res.ok) return setStep('ask');
    if (!profile.reminderEnabled) updateOwnProfile(uid, { reminderEnabled: true });
    await sendTestNotification();
    setStep('sent');
  };

  let body: ReactNode;
  let actions: ReactNode;

  if (step === 'sent' || step === 'not-seen') {
    body =
      step === 'sent' ? (
        <>
          <h1 className="display text-[30px] leading-tight">Notifications are on</h1>
          <p className="mt-3 text-slate-600">We’ve just sent a test notification to this device. Did it appear?</p>
        </>
      ) : (
        <>
          <h1 className="display text-[30px] leading-tight">Let’s find it</h1>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-left text-sm leading-relaxed text-slate-700">
            <li>Swipe down from the top of the screen: it may be in the notification list without a banner.</li>
            <li>Turn off Do Not Disturb, Focus or silent mode, then send it again.</li>
            {isIOS() ? (
              <li>
                Check <i>Settings → Notifications → Mamūlāt</i> and allow notifications, banners and sounds.
              </li>
            ) : (
              <li>
                Check your phone’s <i>Settings → Apps → {isAndroid() ? 'Chrome (or Mamūlāt)' : 'your browser'} → Notifications</i> and make sure they’re allowed.
              </li>
            )}
            {isAndroid() && <li>On Xiaomi, Oppo, Vivo, Huawei and similar phones, also allow the app to run in the background (battery settings).</li>}
          </ul>
        </>
      );
    actions = (
      <>
        <button className="btn-primary w-full" onClick={() => finish('done')}>
          {step === 'sent' ? 'Yes, I got it' : 'It works now'}
        </button>
        <button
          className="btn-secondary w-full"
          onClick={async () => {
            await sendTestNotification();
            setStep('not-seen');
          }}
        >
          {step === 'sent' ? 'No, I didn’t see it' : 'Send another test'}
        </button>
        {step === 'not-seen' && (
          <button className="min-h-11 text-[15px] text-brand-700" onClick={() => finish('done')}>
            Continue anyway
          </button>
        )}
      </>
    );
  } else if (!support.ok && support.reason === 'ios-not-installed') {
    body = (
      <>
        <h1 className="display text-[30px] leading-tight">Add Mamūlāt to your Home Screen</h1>
        <p className="mt-3 text-slate-600">On iPhone and iPad, notifications only work in the Home Screen app. {purpose}</p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-left text-sm leading-relaxed text-slate-700">
          <li>
            In Safari, tap the <b>Share</b> button (the square with an arrow).
          </li>
          <li>
            Choose <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
          <li>Open Mamūlāt from the new icon on your Home Screen and sign in.</li>
          <li>
            Tap <b>Turn on notifications</b> when it asks, then <b>Allow</b>.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Needs iOS 16.4 or later.</p>
      </>
    );
    actions = (
      <button className="btn-secondary w-full" onClick={() => finish('skipped')}>
        Not now
      </button>
    );
  } else if (!support.ok && support.reason === 'denied') {
    body = (
      <>
        <h1 className="display text-[30px] leading-tight">Notifications are blocked</h1>
        <p className="mt-3 text-slate-600">{purpose} They’re blocked on this device, so you need to allow them first:</p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-left text-sm leading-relaxed text-slate-700">
          {isIOS() ? (
            <li>
              Open <i>Settings → Notifications → Mamūlāt</i> and turn on <b>Allow Notifications</b>.
            </li>
          ) : isAndroid() ? (
            <li>
              Tap the icon next to the address bar (or long-press the Mamūlāt icon → <i>App info</i>) → <i>Notifications</i> → <b>Allow</b>.
            </li>
          ) : (
            <li>
              Click the icon next to the address bar → <i>Site settings</i> → <i>Notifications</i> → <b>Allow</b>.
            </li>
          )}
          <li>Then come back here and tap the button below.</li>
        </ul>
      </>
    );
    actions = (
      <>
        <button className="btn-primary w-full" onClick={() => pushSupport().then((s) => (s.ok ? turnOn() : setSupport(s)))}>
          I’ve allowed them
        </button>
        <button className="min-h-11 text-[15px] text-brand-700" onClick={() => finish('skipped')}>
          Not now
        </button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="display text-[30px] leading-tight">Turn on notifications</h1>
        <p className="mt-3 text-slate-600">{purpose}</p>
        <p className="mt-3 text-sm text-slate-600">
          Tap the button below, then tap <b>Allow</b> when your phone asks. We’ll send a test so you can check it works.
        </p>
      </>
    );
    actions = (
      <>
        <button className="btn-primary w-full" disabled={step === 'busy'} onClick={turnOn}>
          {step === 'busy' ? 'Turning on…' : 'Turn on notifications'}
        </button>
        <button className="min-h-11 text-[15px] text-brand-700" disabled={step === 'busy'} onClick={() => finish('skipped')}>
          Not now
        </button>
      </>
    );
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <IconBell size={28} />
        </div>
        {body}
        <div className="mt-8 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
}
