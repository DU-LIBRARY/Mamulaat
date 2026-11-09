import { formatGregorian, formatHijri } from '../lib/dates';

export function DateLine({ day, className = '', size = 'md' }: { day: string; className?: string; size?: 'md' | 'lg' }) {
  const hijri = formatHijri(day);
  return (
    <div className={className}>
      <div className={size === 'lg' ? 'font-serif text-[34px] leading-[1.1] tracking-[-0.01em] text-slate-900' : 'font-medium text-slate-900'}>
        {formatGregorian(day, size === 'lg' ? { weekday: 'long', month: 'long', year: undefined } : { weekday: 'long', month: 'long' })}
      </div>
      {(hijri || size === 'lg') && (
        <div className={size === 'lg' ? 'mt-2 text-sm text-slate-500' : 'mt-0.5 text-sm text-slate-500'}>
          {size === 'lg' ? `${day.slice(0, 4)}${hijri ? ` · ${hijri}` : ''}` : hijri}
        </div>
      )}
    </div>
  );
}
