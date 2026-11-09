import { useSyncExternalStore } from 'react';
import { canPromptInstall, isAndroid, isIOS, isStandalone, promptInstall, subscribeInstall } from '../lib/pwa';

/** "Install the app" card: a real install button where the browser offers one, plus help when it fails. */
export function InstallApp() {
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall);
  if (isStandalone()) return null; // already running as the installed app

  return (
    <section className="card">
      <h2 className="section-title">Install the app</h2>
      {canPrompt && (
        <button type="button" className="btn-primary w-full" onClick={() => void promptInstall()}>
          Install Mamūlāt
        </button>
      )}
      {isIOS() ? (
        <p className="text-sm text-slate-700">
          In Safari, tap Share → <i>Add to Home Screen</i>.
        </p>
      ) : (
        <>
          {!canPrompt && (
            <p className="text-sm text-slate-700">
              {isAndroid() ? 'In Chrome, tap the ⋮ menu → ' : 'In your browser menu, choose '}
              <i>Install app</i> (or <i>Add to Home screen</i> → <i>Install</i>).
            </p>
          )}
          {isAndroid() && (
            <details className="mt-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-900">It says “Unable to install” or the icon doesn't appear</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>
                  Open this page in <b>Chrome</b> itself, not inside WhatsApp, Instagram or another app's browser (use ⋮ → <i>Open in Chrome</i>).
                </li>
                <li>
                  If Mamūlāt was installed before, remove the old copy first: <i>Settings → Apps → Mamūlāt → Uninstall</i>, and delete any old Mamūlāt
                  icon from the home screen. Then in Chrome tap the lock/settings icon next to the address → <i>Site settings → Delete data</i>, reload and
                  install again.
                </li>
                <li>
                  On Xiaomi, Redmi, POCO, Oppo, Realme, Vivo or Huawei phones: go to <i>Settings → Apps → Chrome → Permissions</i> (or{' '}
                  <i>Other permissions</i>) and allow <b>Home screen shortcuts</b>. Without it the shortcut is silently blocked.
                </li>
                <li>
                  Update <b>Chrome</b> and <b>Google Play services</b> from the Play Store, and make sure you have some free storage, then restart the phone and try
                  again.
                </li>
                <li>You can always just use Mamūlāt in Chrome — everything works there, including offline.</li>
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
