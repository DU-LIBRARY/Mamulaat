import { formatGregorian, formatHijri } from '../lib/dates';

export function DateLine({ day, className = '' }: { day: string; className?: string }) {
  const hijri = formatHijri(day);
  return (
    <div className={className}>
      <div className="font-semibold">{formatGregorian(day, { weekday: 'long', month: 'long' })}</div>
      {hijri && <div className="text-sm text-slate-500">{hijri}</div>}
    </div>
  );
}
