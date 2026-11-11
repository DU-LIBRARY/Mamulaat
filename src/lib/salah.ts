import { SALAH_NAMES, type FajrRoll, type SalahDay, type SalahName, type SalahStatus } from '../types';

export const SALAH_LABEL: Record<SalahName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export const STATUS_LABEL: Record<SalahStatus, string> = {
  takbir: 'Takbir',
  jamaat: 'Jamaat',
  qadha: 'Qadha',
  missed: 'Missed',
};

/** Longer wording for the line under each salah and for screen readers. */
export const STATUS_DESC: Record<SalahStatus, string> = {
  takbir: 'In jamaat with the opening takbir',
  jamaat: 'In jamaat',
  qadha: 'Prayed as qadha',
  missed: 'Missed',
};

export const SALAH_STATUSES: SalahStatus[] = ['takbir', 'jamaat', 'qadha', 'missed'];

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
export function fajrRollSummary(roster: Record<string, string>, roll: FajrRoll | null | undefined): RollSummary {
  const out: RollSummary = { missed: [], qadha: [], notLogged: [], inJamaat: [] };
  for (const [uid, name] of Object.entries(roster)) {
    const status = roll?.r?.[uid]?.status;
    const p = { uid, name: name || roll?.r?.[uid]?.name || 'Unnamed' };
    if (status === 'missed') out.missed.push(p);
    else if (status === 'qadha') out.qadha.push(p);
    else if (status === 'takbir' || status === 'jamaat') out.inJamaat.push(p);
    else out.notLogged.push(p);
  }
  out.missed.sort(byName);
  out.qadha.sort(byName);
  out.notLogged.sort(byName);
  out.inJamaat.sort(byName);
  return out;
}
