import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useDocData } from '../../hooks/useFirestore';
import { DayChips } from '../../components/DayChips';
import { DateLine } from '../../components/DateLine';
import { EmptyState, Notice, Spinner } from '../../components/ui';
import { IconChevronLeft, IconLock } from '../../components/icons';
import { isValidYmd } from '../../lib/dates';
import { fajrRollRef, rosterRef } from '../../lib/db';
import { fajrRollSummary, type RollPerson } from '../../lib/salah';
import type { ClassRoster, FajrRoll as Roll } from '../../types';
import { useMyClass } from './Salah';

function Group({ title, people, tone, empty }: { title: string; people: RollPerson[]; tone: string; empty: string }) {
  return (
    <section>
      <h2 className="flex items-baseline justify-between border-b border-slate-200 pb-2">
        <span className="text-[15px] text-slate-900">{title}</span>
        <span className={`num text-[15px] ${people.length ? tone : 'text-slate-400'}`}>{people.length}</span>
      </h2>
      {people.length ? (
        <ul className="divide-y divide-slate-200">
          {people.map((p) => (
            <li key={p.uid} className="py-3 text-[15px] text-slate-800" dir="auto">
              {p.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

/** Read-only daily Fajr roll for the class's Fajr monitor. */
export function FajrRoll() {
  const { profile, today, settings } = useActiveSession();
  const cls = useMyClass();
  const [sp] = useSearchParams();
  const p = sp.get('date');
  const day = p && isValidYmd(p) && p <= today ? p : today;
  const classId = profile.classId ?? '';
  const isMonitor = !!cls && cls.fajrMonitorId === profile.id;
  const roll = useDocData<Roll>(isMonitor ? fajrRollRef(classId, day) : null, `roll:${classId}:${day}:${isMonitor}`);
  const roster = useDocData<ClassRoster>(isMonitor ? rosterRef(classId) : null, `roster:${classId}:${isMonitor}`);

  if (!profile.classId) return <Navigate to="/salah" replace />;
  if (cls === null) return <Spinner />;
  if (!isMonitor) return <Navigate to="/salah" replace />;

  const sum = fajrRollSummary(roster.data?.names ?? {}, roll.data);
  const total = Object.keys(roster.data?.names ?? {}).length;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/salah" className="link -mb-2 inline-flex items-center gap-1 self-start">
        <IconChevronLeft size={16} /> Salah
      </Link>
      <div>
        <div className="text-[13px] text-slate-500" dir="auto">
          Fajr roll · {cls.name}
        </div>
      </div>
      <DayChips day={day} today={today} backfillDays={settings.backfillDays} count={7} showLocks={false} hrefFor={(d) => (d === today ? '/salah/fajr' : `/salah/fajr?date=${d}`)} />
      <DateLine day={day} size="lg" />

      {roll.error || roster.error ? (
        <Notice tone="warn">Couldn’t load the Fajr roll. Check your connection and try again.</Notice>
      ) : roll.loading || roster.loading ? (
        <Spinner />
      ) : total === 0 ? (
        <EmptyState>The class list isn’t ready yet. Ask your teacher to open the class page once.</EmptyState>
      ) : (
        <>
          <p className="num text-[15px] text-slate-700">
            {sum.missed.length} missed · {sum.qadha.length} qadha · {sum.notLogged.length} not logged · {sum.inJamaat.length} in jamaat
          </p>
          <Group title="Missed" people={sum.missed} tone="text-red-800" empty="Nobody missed Fajr." />
          <Group title="Qadha" people={sum.qadha} tone="text-amber-800" empty="Nobody prayed Fajr as qadha." />
          <Group title="Not logged yet" people={sum.notLogged} tone="text-slate-900" empty="Everyone has logged Fajr." />
          <section className="flex items-baseline justify-between border-b border-slate-200 pb-2">
            <span className="text-[15px] text-slate-900">Prayed in jamaat</span>
            <span className="num text-[15px] text-brand-700">{sum.inJamaat.length}</span>
          </section>
        </>
      )}

      <Notice icon={<IconLock size={18} />}>
        Only you and your teacher can see this list. Please keep it to yourself and use it to encourage, not to embarrass.
      </Notice>
    </div>
  );
}
