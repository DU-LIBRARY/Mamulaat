import type { DayLog } from '../types';
import type { Actor } from '../lib/db';
import { entryFraction, FRIDAY_PARTS, fridayEntry, isFridayMamoolDay, pct } from '../lib/scoring';
import { Checklist } from './Checklist';

/**
 * The Friday Mamool (1000 Durood and Surah Kahf), shown apart from the usual list on Fridays for
 * everyone. The two are ticked off separately but count as one mamool: both = 100%, one = 50%.
 */
export function FridayMamool({
  uid,
  day,
  log,
  editable,
  asAdmin,
  self,
}: {
  uid: string;
  day: string;
  log: DayLog | undefined;
  editable: boolean;
  /** The admin editing a student's day (stamped and audited). */
  asAdmin?: Actor;
  /** The admin logging their own (stamped, not audited). */
  self?: Actor;
}) {
  if (!isFridayMamoolDay(day)) return null;
  const e = fridayEntry(log);
  return (
    <section aria-labelledby={`friday-${day}`} className="rounded-xl border border-gold-400/70 bg-gold-50 px-3 pt-3 pb-1">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`friday-${day}`} className="font-serif text-[20px] leading-tight text-gold-900">
            Friday Mamool
          </h2>
          <p className="text-[13px] text-gold-900/75">Every Jumu‘ah · counts as one mamool</p>
        </div>
        <span className="num font-serif text-[22px] leading-none text-gold-900">{e ? pct(entryFraction(e)) : '–'}</span>
      </header>
      <div className="mt-2">
        <Checklist uid={uid} day={day} mamoolaat={FRIDAY_PARTS} log={log} editable={editable} asAdmin={asAdmin} self={self} hideMarkRest />
      </div>
    </section>
  );
}
