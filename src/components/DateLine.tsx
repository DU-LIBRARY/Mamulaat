import { formatGregorian, formatHijri } from '../lib/dates';

export function DateLine({ day, className = '', size = 'md', onTile = false }: { day: string; className?: string; size?: 'md' | 'lg'; onTile?: boolean }) {
  const hijri = formatHijri(day);
  return (
    <div className={className}>
      <div className={size === 'lg' ? `text-[23px] leading-[1.2] font-semibold tracking-[-0.025em] ${onTile ? 'text-white' : 'text-slate-900'}` : 'font-medium text-slate-900'}>
        {formatGregorian(day, size === 'lg' ? { weekday: 'long', month: 'long', year: undefined } : { weekday: 'long', month: 'long' })}
      </div>
      {(hijri || size === 'lg') && (
        <div className={`mt-0.5 text-sm ${onTile ? 'text-white/70' : 'text-slate-500'}`}>
          {size === 'lg' ? `${day.slice(0, 4)}${hijri ? ` · ${hijri}` : ''}` : hijri}
        </div>
      )}
    </div>
  );
}
