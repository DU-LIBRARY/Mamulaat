import { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { pushSupport, pushSupportMessage, registerDevice, type PushSupport } from '../lib/messaging';
import { FullScreen } from '../components/ui';
import { useClasses } from '../hooks/useAdminData';
import type { UserProfile } from '../types';
import { Wordmark } from '../components/Layout';

const copy: Record<string, { title: string; body: string }> = {
  pending: {
    title: 'Waiting for approval',
    body: 'Your account has been created. Your teacher needs to approve it and add you to a class before you can start. Check back soon — this page updates automatically.',
  },
  inactive: {
    title: 'Account deactivated',
    body: 'Your account is currently deactivated. Please contact your teacher if you think this is a mistake.',
  },
  rejected: {
    title: 'Access not granted',
    body: 'Your sign-up request was not approved. Please contact your teacher if you think this is a mistake.',
  },
};

const ASKED_KEY = 'mamulaat.notifyOnApproval';

/** Lets a pending student get a notification on this device when the teacher approves them. */
function NotifyWhenApproved({ uid }: { uid: string }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'error'>(() => {
    try {
      return localStorage.getItem(ASKED_KEY) === uid && Notification.permission === 'granted' ? 'on' : 'idle';
    } catch {
      return 'idle';
    }
  });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);
  if (!support) return null;
  if (!support.ok && support.reason !== 'denied' && support.reason !== 'ios-not-installed') return null;
  if (state === 'on') return <p className="mt-4 max-w-sm text-sm text-brand-700">We'll send a notification to this device when you're approved.</p>;
  return (
    <div className="mt-4 flex max-w-sm flex-col items-center gap-2">
      <button
        className="btn-secondary"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          const r = await registerDevice(uid);
          if (r.ok) {
            try {
              localStorage.setItem(ASKED_KEY, uid);
            } catch {
              /* private mode */
            }
            setState('on');
          } else {
            setState('error');
            setMsg(pushSupportMessage[r.reason]);
          }
        }}
      >
        Notify me when I'm approved
      </button>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}

export function Waiting({ profile }: { profile: UserProfile }) {
  const { signOut } = useSession();
  const classes = useClasses();
  const requested = classes.data.find((x) => x.id === profile.requestedClassId);
  const c = profile.handedOverTo
    ? {
        title: 'Admin role handed over',
        body: 'You transferred the admin role. You no longer have access to student data in this app.',
      }
    : (copy[profile.status] ?? copy.pending);
  return (
    <FullScreen>
      <Wordmark className="mb-10" />
      <h1 className="display text-[34px] leading-tight">{c.title}</h1>
      <p className="mt-2 max-w-sm leading-relaxed text-slate-600">{c.body}</p>
      <div className="mt-6 flex w-full max-w-sm items-center gap-3 rounded-xl bg-surface p-3">
        {profile.photoURL && <img src={profile.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />}
        <div className="text-left">
          <div className="font-medium text-slate-900">{profile.name}</div>
          <div className="text-sm text-slate-500">{profile.email}</div>
          {profile.status === 'pending' && requested && <div className="text-sm text-slate-600">Requested class: {requested.name}</div>}
        </div>
      </div>
      {profile.status === 'pending' && !profile.handedOverTo && <NotifyWhenApproved uid={profile.id} />}
      <button className="btn-ghost mt-6" onClick={() => signOut()}>
        Sign out
      </button>
    </FullScreen>
  );
}

export function ConfigMissing() {
  return (
    <FullScreen>
      <Wordmark className="mb-10" />
      <h1 className="display text-[34px] leading-tight">Firebase is not configured</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in your dedicated Mamulaat Firebase project's
        config (or use <code>.env.emulator.example</code> for local emulators). See the README.
      </p>
    </FullScreen>
  );
}
