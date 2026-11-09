import { useState } from 'react';
import { useSession } from '../hooks/useSession';
import { PrivacyNote } from '../components/PrivacyNote';
import { DateLine } from '../components/DateLine';

export function SignIn() {
  const { signIn, signInWithPassword, today } = useSession();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col px-6 pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-11 w-11 rounded-[9px]" />
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Mamūlāt</h1>
        <p className="mt-2 text-[17px] leading-relaxed text-slate-600">Keep your daily mamoolaat, and share your progress privately with your teacher.</p>
        <DateLine day={today} className="mt-6 border-t border-slate-200 pt-4 text-slate-700" />

        <button
          className="btn mt-8 w-full border border-slate-300 bg-surface text-slate-800 hover:bg-slate-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signIn();
            } catch (e) {
              setError(navigator.onLine ? (e as Error).message : 'You need to be online to sign in the first time.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy && !showEmail ? 'Signing in…' : 'Continue with Google'}
        </button>

        {!showEmail ? (
          <button className="mt-4 self-center text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900" onClick={() => setShowEmail(true)}>
            Use email and password instead
          </button>
        ) : (
          <form
            className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await signInWithPassword(email, password);
              } catch (err) {
                setError(navigator.onLine ? (err as Error).message : 'You need to be online to sign in the first time.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <label className="label" htmlFor="si-email">
                Email
              </label>
              <input id="si-email" className="input" type="email" autoComplete="username" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="si-pass">
                Password
              </label>
              <input id="si-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary mt-1 w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="mx-auto w-full max-w-sm pb-8">
        <PrivacyNote compact />
      </div>
    </div>
  );
}
