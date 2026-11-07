import { useRef, useState, type FormEvent } from 'react';
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
  // Start empty: the student must type the name their teacher will see (not their Google name).
  const [name, setName] = useState('');
  const [pickedClass, setClassId] = useState(profile.requestedClassId ?? '');
  // Ignore a remembered class that has since been deleted
  const classId = classes.data.some((c) => c.id === pickedClass) ? pickedClass : '';
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false); // guards double-taps before React re-renders
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting.current || !name.trim() || !classId) return;
    if (!navigator.onLine) {
      // A queued write would sit "Saving…" forever, so ask them to reconnect instead.
      setError('You are offline. Please connect to the internet and try again.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await completeSignup(profile.id, name, classId);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      submitting.current = false;
    }
  };

  return (
    <FullScreen>
      <div className="w-full max-w-sm text-left">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-slate-900">Request access</h1>
        <p className="mt-2 mb-6 leading-relaxed text-slate-600">Tell us who you are. Your teacher will approve your request.</p>
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
            <p className="mt-1.5 text-xs text-slate-500">This is the name your teacher will see. Please use your real name.</p>
          </div>
          <div>
            <label className="label" htmlFor="class">
              Your class
            </label>
            {classes.loading ? (
              <Spinner label="Loading classes…" />
            ) : classes.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Could not load the class list: {classes.error.message}</p>
            ) : classes.data.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No classes have been set up yet. Please ask your teacher, then try again.</p>
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
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
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
