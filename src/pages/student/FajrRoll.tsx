import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useActiveSession } from '../../hooks/useSession';
import { DayChips } from '../../components/DayChips';
import { Notice, Spinner } from '../../components/ui';
import { IconCheck, IconChevronLeft, IconLock } from '../../components/icons';
import { formatGregorian, formatHijri, isValidYmd, timeIn } from '../../lib/dates';
import { fajrRollRef, rosterRef } from '../../lib/db';
import { fajrRollSummary, type RollPerson } from '../../lib/salah';
import type { ClassDoc, ClassRoster, FajrRoll as Roll } from '../../types';
import { useMonitoredClasses } from './Salah';

interface ClassState {
  roll: Roll | null;
  roster: ClassRoster | null;
  loaded: number; // 2 when both have arrived
  error: boolean;
}

/** Live roll + roster for each class on one day. */
function useRolls(classes: ClassDoc[], day: string) {
  const key = `${classes.map((c) => c.id).join(',')}|${day}`;
  const [state, setState] = useState<Map<string, ClassState>>(new Map());
  useEffect(() => {
    setState(new Map(classes.map((c) => [c.id, { roll: null, roster: null, loaded: 0, error: false }])));
    const patch = (id: string, p: Partial<ClassState>, arrived = true) =>
      setState((prev) => {
        const n = new Map(prev);
        const cur = n.get(id) ?? { roll: null, roster: null, loaded: 0, error: false };
        n.set(id, { ...cur, ...p, loaded: cur.loaded + (arrived ? 1 : 0) });
        return n;
      });
    const unsubs = classes.flatMap((c) => {
      let rollSeen = false;
      let rosterSeen = false;
      return [
        onSnapshot(
          fajrRollRef(c.id, day),
          (s) => {
            patch(c.id, { roll: s.exists() ? ({ id: s.id, ...s.data() } as Roll) : null }, !rollSeen);
            rollSeen = true;
          },
          () => patch(c.id, { error: true }),
        ),
        onSnapshot(
          rosterRef(c.id),
          (s) => {
            patch(c.id, { roster: (s.data() as ClassRoster | undefined) ?? null }, !rosterSeen);
            rosterSeen = true;
          },
          () => patch(c.id, { error: true }),
        ),
      ];
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Anyone who hasn't logged Fajr by this time (project timezone) counts as missed. */
const LOG_CUTOFF = '08:05';

type Kind = 'missed' | 'notLogged';
const KIND: Record<Kind, { label: string; tone: string; empty: string }> = {
  missed: { label: 'Missed', tone: 'text-red-800', empty: 'Nobody missed Fajr.' },
  notLogged: { label: 'Not logged', tone: 'text-slate-900', empty: 'Everyone has logged Fajr.' },
};

function NameList({ kind, people, ready }: { kind: Kind; people: RollPerson[]; ready: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl bg-surface">
      <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-[17px] font-medium text-slate-900">{KIND[kind].label}</h2>
        <span className={`num font-serif text-[28px] leading-none ${people.length ? KIND[kind].tone : 'text-slate-400'}`}>{ready ? people.length : '–'}</span>
      </header>
      {!ready ? (
        <div className="px-4 py-3">
          <Spinner />
        </div>
      ) : people.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-3 text-[15px] text-slate-600">
          <IconCheck size={16} /> {KIND[kind].empty}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {people.map((p) => (
            <li key={p.uid} className="flex min-h-12 items-center px-4 py-2 text-[16px] text-slate-900" dir="auto">
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Read-only daily Fajr register for a Fajr monitor: two lists across every class they look
 * after. "Missed" covers missed and qadha alike; nobody who prayed is listed.
 */
export function FajrRoll() {
  const { today, settings } = useActiveSession();
  const monitored = useMonitoredClasses();
  const [sp] = useSearchParams();
  const p = sp.get('date');
  const day = p && isValidYmd(p) && p <= today ? p : today;
  const rolls = useRolls(monitored.data, day);

  if (monitored.loading) return <Spinner />;
  if (!monitored.data.length) return <Navigate to="/salah" replace />;

  const states = monitored.data.map((c) => rolls.get(c.id));
  const ready = states.every((st) => st && st.loaded >= 2);
  const failed = states.some((st) => st?.error);
  const missed: RollPerson[] = [];
  const notLogged: RollPerson[] = [];
  const seen = new Set<string>();
  for (const st of states) {
    if (!st || st.error) continue;
    const sum = fajrRollSummary(st.roster?.names ?? {}, st.roll);
    for (const x of [...sum.missed, ...sum.qadha]) if (!seen.has(x.uid)) (seen.add(x.uid), missed.push(x));
    for (const x of sum.notLogged) if (!seen.has(x.uid)) (seen.add(x.uid), notLogged.push(x));
  }
  const byName = (a: RollPerson, b: RollPerson) => a.name.localeCompare(b.name);
  // After the cutoff (or on any earlier day) not logging counts as missing.
  const closed = day < today || timeIn(settings.timezone) >= LOG_CUTOFF;
  if (closed) missed.push(...notLogged.splice(0));
  missed.sort(byName);
  notLogged.sort(byName);
  // Biggest list first.
  const lists: { kind: Kind; people: RollPerson[] }[] = closed
    ? [{ kind: 'missed', people: missed }]
    : [
        { kind: 'missed' as Kind, people: missed },
        { kind: 'notLogged' as Kind, people: notLogged },
      ].sort((a, b) => b.people.length - a.people.length);
  const hijri = formatHijri(day);

  return (
    <div className="flex flex-col gap-5">
      <Link to="/salah" className="link -mb-1 inline-flex items-center gap-1 self-start">
        <IconChevronLeft size={16} /> Salah
      </Link>
      <header>
        <h1 className="font-serif text-[34px] leading-[1.1] text-slate-900">Fajr register</h1>
        <p className="mt-1 text-sm text-slate-500">
          {day === today ? 'Today, ' : ''}
          {formatGregorian(day, { weekday: 'long', month: 'long', year: undefined })}
          {hijri ? ` · ${hijri}` : ''}
        </p>
      </header>
      <DayChips day={day} today={today} backfillDays={settings.backfillDays} count={7} showLocks={false} hrefFor={(d) => (d === today ? '/salah/fajr' : `/salah/fajr?date=${d}`)} />

      {failed && <Notice tone="warn">Some of the register couldn’t load. Check your connection.</Notice>}
      {lists.map((l) => (
        <NameList key={l.kind} kind={l.kind} people={l.people} ready={ready} />
      ))}
      <p className="-mt-2 text-xs text-slate-500">
        {closed ? `Anyone who didn’t log Fajr by ${LOG_CUTOFF} is counted as missed.` : `Anyone who hasn’t logged by ${LOG_CUTOFF} will be counted as missed.`}
      </p>

      <Notice icon={<IconLock size={18} />}>Only you and your teacher can see this. Please keep it to yourself and use it to encourage, not to embarrass.</Notice>
    </div>
  );
}
