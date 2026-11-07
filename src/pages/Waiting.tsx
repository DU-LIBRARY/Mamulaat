import { useSession } from '../hooks/useSession';
import { FullScreen } from '../components/ui';
import type { UserProfile } from '../types';

const copy: Record<string, { icon: string; title: string; body: string }> = {
  pending: {
    icon: '⏳',
    title: 'Waiting for approval',
    body: 'Your account has been created. Your teacher needs to approve it and add you to a class before you can start. Check back soon — this page updates automatically.',
  },
  inactive: {
    icon: '⏸️',
    title: 'Account deactivated',
    body: 'Your account is currently deactivated. Please contact your teacher if you think this is a mistake.',
  },
  rejected: {
    icon: '🚫',
    title: 'Access not granted',
    body: 'Your sign-up request was not approved. Please contact your teacher if you think this is a mistake.',
  },
};

export function Waiting({ profile }: { profile: UserProfile }) {
  const { signOut } = useSession();
  const c = profile.handedOverTo
    ? {
        icon: '🤝',
        title: 'Admin role handed over',
        body: 'You transferred the admin role. You no longer have access to student data in this app.',
      }
    : (copy[profile.status] ?? copy.pending);
  return (
    <FullScreen>
      <div className="mb-4 text-6xl" aria-hidden>
        {c.icon}
      </div>
      <h1 className="text-2xl font-bold text-brand-900">{c.title}</h1>
      <p className="mt-2 max-w-sm text-slate-600">{c.body}</p>
      <div className="mt-6 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        {profile.photoURL && <img src={profile.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />}
        <div className="text-left">
          <div className="font-semibold">{profile.name}</div>
          <div className="text-sm text-slate-500">{profile.email}</div>
        </div>
      </div>
      <button className="btn-ghost mt-6" onClick={() => signOut()}>
        Sign out
      </button>
    </FullScreen>
  );
}

export function ConfigMissing() {
  return (
    <FullScreen>
      <div className="mb-4 text-5xl">⚙️</div>
      <h1 className="text-2xl font-bold">Firebase is not configured</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in your dedicated Mamulaat Firebase project's
        config (or use <code>.env.emulator.example</code> for local emulators). See the README.
      </p>
    </FullScreen>
  );
}
