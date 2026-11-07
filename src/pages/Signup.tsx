import { useState, type FormEvent } from 'react';
import { useSession } from '../hooks/useSession';
import { useClasses } from '../hooks/useAdminData';
import { completeSignup } from '../lib/db';
import { FullScreen, Spinner } from '../components/ui';
import { PrivacyNote } from '../components/PrivacyNote';
import type { UserProfile } from '../types';

/** Shown once to a new student: enter your name and pick your class, then wait for approval. */
export function Signup({ profile }: { profile: UserProfile }) {
  const { signOut } = useSession();
  const classes = useClasses();
  const [name, setName] = useState(profile.name ?? '');
  const [classId, setClassId] = useState(profile.requestedClassId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !classId) return;
    setBusy(true);
    setError(null);
    try {
      await completeSignup(profile.id, name, classId);
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'You need to be online to sign up.');
      setBusy(false);
    }
  };

  return (
    <FullScreen>
      <div className="w-full max-w-sm text-left">
        <h1 className="text-center text-2xl font-extrabold text-brand-900">Welcome to Mamulaat</h1>
        <p className="mt-1 mb-5 text-center text-slate-600">Tell us who you are. Your teacher will approve your request.</p>
        <form onSubmit={submit} className="card flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              maxLength={100}
              autoComplete="name"
              required
            />
            <p className="mt-1 text-xs text-slate-500">This is the name you'll see in the app and your teacher will see.</p>
          </div>
          <div>
            <label className="label" htmlFor="class">
              Your class
            </label>
            {classes.loading ? (
              <Spinner label="Loading classes…" />
            ) : classes.data.length === 0 ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No classes have been set up yet. Please ask your teacher, then try again.</p>
            ) : (
              <select id="class" className="input" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                <option value="">Choose your class…</option>
                {classes.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy || !name.trim() || !classId}>
            {busy ? 'Saving…' : 'Request access'}
          </button>
        </form>
        <div className="mt-4">
          <PrivacyNote compact />
        </div>
        <div className="mt-4 text-center">
          <button className="btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </FullScreen>
  );
}
