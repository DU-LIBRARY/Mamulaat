import { useThemePref, type ThemePref } from '../lib/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Appearance setting: a three-way segmented control (saved on this device only). */
export function ThemePicker() {
  const [pref, setPref] = useThemePref();
  return (
    <section className="card">
      <h2 className="section-title" id="theme-title">
        Appearance
      </h2>
      <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-labelledby="theme-title">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pref === o.value}
            className={`btn min-h-10 flex-1 rounded px-3 text-sm ${pref === o.value ? 'bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setPref(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">System follows your device's light or dark setting. Saved on this device.</p>
    </section>
  );
}
