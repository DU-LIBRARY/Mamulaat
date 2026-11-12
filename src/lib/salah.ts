import { SALAH_NAMES, type FajrRoll, type RollStatus, type SalahDay, type SalahName, type SalahStatus } from '../types';

export const SALAH_LABEL: Record<SalahName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export const STATUS_LABEL: Record<SalahStatus, string> = {
  takbir: 'Takbir Ula',
  jamaat: 'Jamaat',
  qadha: 'Qadha',
  missed: 'Missed',
};

/** Longer wording for the line under each salah and for screen readers. */
export const STATUS_DESC: Record<SalahStatus, string> = {
  takbir: 'In jamaat with Takbir Ula',
  jamaat: 'In jamaat',
  qadha: 'Prayed as qadha',
  missed: 'Missed',
};

export const SALAH_STATUSES: SalahStatus[] = ['takbir', 'jamaat', 'qadha', 'missed'];

/**
 * Salah history before this day was cleared, so a day before it with nothing logged is just
 * "not logged", never missed. From this day on, nothing logged on a day that's over is missed.
 */
export const MISSED_RULE_FROM = '2026-11-12';

/** Today's Fajr not logged by this time (project timezone) counts as missed. */
export const FAJR_LOG_CUTOFF = '08:05';

/**
 * Does nothing logged for salah `name` on day `d` count as missed? From MISSED_RULE_FROM: yes for
 * days that are over, and for today's Fajr once `now` ("HH:MM", project timezone) reaches
 * FAJR_LOG_CUTOFF. The rest of today's salah stay "not logged" until the day is over.
 */
export const unloggedIsMissed = (d: string, today: string, name?: SalahName, now?: string) =>
  d >= MISSED_RULE_FROM && (d < today || (d === today && name === 'fajr' && !!now && now >= FAJR_LOG_CUTOFF));

/** Missed and qadha both count as missed for the Fajr register; takbir and jamaat as prayed. */
export const rollStatusOf = (s: SalahStatus): RollStatus => (s === 'missed' || s === 'qadha' ? 'missed' : 'prayed');

/** What the admin sees: Takbir Ula counts as Jamaat and Qadha as Missed. Students see their own statuses. */
export const adminStatus = (s: SalahStatus | undefined): SalahStatus | undefined => (s === 'takbir' ? 'jamaat' : s === 'qadha' ? 'missed' : s);

export const isSalahStatus = (v: unknown): v is SalahStatus => typeof v === 'string' && (SALAH_STATUSES as string[]).includes(v);

export interface SalahStats {
  logged: number;
  takbir: number;
  jamaat: number;
  qadha: number;
  missed: number;
  /** Prayed in jamaat (with or without the opening takbir). */
  inJamaat: number;
}

export function salahStats(d: SalahDay | undefined): SalahStats {
  const s: SalahStats = { logged: 0, takbir: 0, jamaat: 0, qadha: 0, missed: 0, inJamaat: 0 };
  for (const n of SALAH_NAMES) {
    const v = d?.entries?.[n];
    if (!isSalahStatus(v)) continue;
    s.logged++;
    s[v]++;
  }
  s.inJamaat = s.takbir + s.jamaat;
  return s;
}

export interface RollPerson {
  uid: string;
  name: string;
}

export interface RollSummary {
  missed: RollPerson[];
  qadha: RollPerson[];
  notLogged: RollPerson[];
  /** Prayed Fajr in jamaat (takbir or joined late). */
  inJamaat: RollPerson[];
}

const byName = (a: RollPerson, b: RollPerson) => a.name.localeCompare(b.name);

/**
 * Sort the class into groups for one day's Fajr. Everyone on the roster without an entry is
 * "not logged"; people who logged but have since left the class are left out.
 */
export function fajrRollSummary(roster: Record<string, string>, roll: { r?: Record<string, { name?: string; status?: string }> } | FajrRoll | null | undefined): RollSummary {
  const out: RollSummary = { missed: [], qadha: [], notLogged: [], inJamaat: [] };
  for (const [uid, name] of Object.entries(roster)) {
    const status = roll?.r?.[uid]?.status;
    const p = { uid, name: name || roll?.r?.[uid]?.name || 'Unnamed' };
    // The register stores missed/prayed; the admin's own summary passes full statuses.
    const st = status as string | undefined;
    if (st === 'missed') out.missed.push(p);
    else if (st === 'qadha') out.qadha.push(p);
    else if (st === 'takbir' || st === 'jamaat' || st === 'prayed') out.inJamaat.push(p);
    else out.notLogged.push(p);
  }
  out.missed.sort(byName);
  out.qadha.sort(byName);
  out.notLogged.sort(byName);
  out.inJamaat.sort(byName);
  return out;
}

/**
 * How many salah a student missed over these days, for ranking: missed and qadha count, and so
 * does nothing logged on a day that is over. Today's unlogged salah are not counted yet.
 */
export function missedCount(by: Map<string, SalahDay> | undefined, days: string[], today: string, only?: SalahName[], now?: string): number {
  let n = 0;
  for (const d of days) {
    if (d > today) continue;
    for (const name of only ?? SALAH_NAMES) {
      const s = by?.get(d)?.entries?.[name];
      if (s === 'missed' || s === 'qadha' || (!s && unloggedIsMissed(d, today, name, now))) n++;
    }
  }
  return n;
}

/**
 * Share of salah prayed in jamaat (with or without Takbir Ula) over these days, from `from`
 * (the first day the student logged salah) up to today. Nothing logged on a day that's over
 * counts as not in jamaat; today counts only what's been logged so far. Null when nothing counts.
 */
export function jamaatRate(salah: Map<string, SalahDay>, days: string[], today: string, from: string | null): number | null {
  if (!from) return null;
  let inJamaat = 0;
  let total = 0;
  for (const d of days) {
    if (d < from || d < MISSED_RULE_FROM || d > today) continue;
    for (const n of SALAH_NAMES) {
      const s = salah.get(d)?.entries?.[n];
      if (d === today && !s) continue;
      total++;
      if (s === 'takbir' || s === 'jamaat') inJamaat++;
    }
  }
  return total ? inJamaat / total : null;
}
