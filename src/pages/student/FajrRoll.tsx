import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useActiveSession } from '../../hooks/useSession';
import { DayChips } from '../../components/DayChips';
import { EmptyState, Notice, Spinner } from '../../components/ui';
import { IconCheck, IconChevronLeft, IconClock, IconLock, IconX } from '../../components/icons';
import { formatGregorian, formatHijri, isValidYmd } from '../../lib/dates';
import { fajrRollRef, rosterRef } from '../../lib/db';
import { fajrRollSummary, type RollSummary } from '../../lib/salah';
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

type Kind = 'missed' | 'qadha' | 'notLogged';
const KIND: Record<Kind, { label: string; pill: string; icon: ReactNode; tile: string }> = {
  missed: { label: 'Missed', pill: 'bg-red-100 text-red-800', icon: <IconX size={13} weight="bold" />, tile: 'text-red-800' },
  qadha: { label: 'Qadha', pill: 'bg-amber-100 text-amber-900', icon: <IconClock size={13} weight="bold" />, tile: 'text-amber-900' },
  notLogged: { label: 'Not logged', pill: 'bg-slate-100 text-slate-700', icon: null, tile: 'text-slate-900' },
};
const ORDER: Kind[] = ['missed', 'qadha', 'notLogged'];

function Tile({ kind, n }: { kind: Kind; n: number }) {
  return (
    <div className="flex flex-col items-start gap-1 px-4 py-3">
      <span className="text-[12px] text-slate-500">{KIND[kind].label}</span>
      <span className={`num font-serif text-[34px] leading-none ${n ? KIND[kind].tile : 'text-slate-400'}`}>{n}</span>
    </div>
  );
}

function ClassCard({ cls, sum, state }: { cls: ClassDoc; sum: RollSummary | null; state: ClassState | undefined }) {
  const people = sum ? ORDER.flatMap((k) => sum[k].map((p) => ({ ...p, kind: k }))) : [];
  return (
    <section className="overflow-hidden rounded-xl bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="min-w-0 truncate text-[17px] font-medium text-slate-900" dir="auto">
          {cls.name}
        </h2>
        {sum && people.length > 0 && (
          <span className="num shrink-0 text-[13px] text-slate-500">
            {people.length} to follow up
          </span>
        )}
      </header>
      {state?.error ? (
        <p className="px-4 py-3 text-sm text-amber-900">Couldn’t load this class. Check your connection.</p>
      ) : !sum ? (
        <div className="px-4 py-3">
          <Spinner />
        </div>
      ) : Object.keys(state?.roster?.names ?? {}).length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">The class list isn’t ready yet. Ask your teacher to open this class once.</p>
      ) : people.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-3 text-[15px] text-slate-600">
          <IconCheck size={16} /> Nobody to follow up
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {people.map((p) => (
            <li key={p.uid} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0 truncate text-[16px] text-slate-900" dir="auto">
                {p.name}
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${KIND[p.kind].pill}`}>
                {KIND[p.kind].icon}
                {KIND[p.kind].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Read-only daily Fajr register for a Fajr monitor: only the students to follow up
 * (missed, qadha, not logged), one card per class they look after.
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

  const sums = new Map(
    monitored.data.map((c) => {
      const st = rolls.get(c.id);
      return [c.id, st && st.loaded >= 2 && !st.error ? fajrRollSummary(st.roster?.names ?? {}, st.roll) : null] as const;
    }),
  );
  const total = (k: Kind) => [...sums.values()].reduce((n, s) => n + (s ? s[k].length : 0), 0);
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

      <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-surface" aria-label="Totals across your classes">
        {ORDER.map((k) => (
          <Tile key={k} kind={k} n={total(k)} />
        ))}
      </div>

      {monitored.data.length === 0 ? (
        <EmptyState>No classes.</EmptyState>
      ) : (
        monitored.data.map((c) => <ClassCard key={c.id} cls={c} sum={sums.get(c.id) ?? null} state={rolls.get(c.id)} />)
      )}

      <Notice icon={<IconLock size={18} />}>Only you and your teacher can see this. Please keep it to yourself and use it to encourage, not to embarrass.</Notice>
    </div>
  );
}
