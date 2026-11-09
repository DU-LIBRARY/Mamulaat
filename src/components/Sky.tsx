import { useEffect, useState } from 'react';

/**
 * The sky at the top of every screen, following the time of prayer: a soft wash that
 * fades into the page within the first screenful. Fajr is a blue dawn, the day is pale,
 * Asr warms, Maghrib turns rose-clay, Isha is night. Purely decorative.
 */
type Period = 'fajr' | 'day' | 'asr' | 'maghrib' | 'isha';

function periodAt(d: Date): Period {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 6.5) return 'fajr';
  if (h >= 6.5 && h < 14.5) return 'day';
  if (h >= 14.5 && h < 17) return 'asr';
  if (h >= 17 && h < 19.5) return 'maghrib';
  return 'isha';
}

export function usePrayerPeriod(): Period {
  const [p, setP] = useState(() => periodAt(new Date()));
  useEffect(() => {
    const t = setInterval(() => setP(periodAt(new Date())), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return p;
}

export function Sky({ className = '' }: { className?: string }) {
  const period = usePrayerPeriod();
  return <div aria-hidden data-sky={period} className={`sky pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] ${className}`} />;
}
