import { useEffect, useState } from 'react';

/** The viewer's colour-scheme choice; "system" follows the device setting. Stored per device. */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'mamulaat-theme';
const LIGHT_BAR = '#f5f4ef';
const DARK_BAR = '#121210';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage blocked — fall back to system */
  }
  return 'system';
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && !!media?.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? DARK_BAR : LIGHT_BAR);
}

const listeners = new Set<(p: ThemePref) => void>();

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  apply(pref);
  listeners.forEach((l) => l(pref));
}

/** Call once at startup: applies the saved choice and follows device changes while on "system". */
export function initTheme() {
  apply(getThemePref());
  media?.addEventListener('change', () => {
    if (getThemePref() === 'system') apply('system');
  });
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState(getThemePref);
  useEffect(() => {
    listeners.add(setPref);
    return () => {
      listeners.delete(setPref);
    };
  }, []);
  return [pref, setThemePref];
}
