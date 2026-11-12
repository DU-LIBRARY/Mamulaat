import { SALAH_NAMES, type DayLog, type Mamool, type SalahDay, type UserProfile } from '../types';
import { adminStatus, SALAH_LABEL, STATUS_LABEL } from './salah';
import { dayStats, entryFraction, mamoolCompletion, periodCompletion, scheduledFor } from './scoring';
import { studentWeek } from './reports';

type Cell = string | number | null;
const pctCell = (f: number | null | undefined): Cell => (f == null ? '' : Math.round(f * 100));

function targetText(m: Pick<Mamool, 'target' | 'unit'>) {
  return `${m.target}${m.unit ? ` ${m.unit}` : ''}`;
}

export interface StudentData {
  mamoolaat: Mamool[];
  logs: Map<string, DayLog>;
  salah?: Map<string, SalahDay>;
}

/** One row per salah: its status each day ('' after today), then how many days were in jamaat. */
export function salahRows(salah: Map<string, SalahDay>, days: string[], today: string, lead: Cell[] = []): Cell[][] {
  return SALAH_NAMES.map((n) => {
    const cells = days.map((d) => {
      if (d > today) return '';
      const st = salah.get(d)?.entries?.[n];
      // Admin exports: Takbir Ula counts as Jamaat and qadha as missed.
      return st ? STATUS_LABEL[adminStatus(st)!] : 'not logged';
    });
    const inJamaat = days.filter((d) => d <= today && ['takbir', 'jamaat'].includes(salah.get(d)?.entries?.[n] ?? '')).length;
    return [...lead, SALAH_LABEL[n], ...cells, inJamaat];
  });
}

/**
 * One row per student (overall %), followed by one row per mamool, for any range of days.
 * Days after `today` are left blank. Works for a week or a whole month.
 */
export function registerRows(
  students: UserProfile[],
  data: Map<string, StudentData>,
  days: string[],
  today: string,
  classNameOf: (s: UserProfile) => string,
): Cell[][] {
  const header: Cell[] = ['Student', 'Class', 'Mamool', 'Target', ...days, 'Overall %', 'Full days', 'Days logged'];
  const rows: Cell[][] = [header];
  for (const s of students) {
    const d: StudentData = data.get(s.id) ?? { mamoolaat: [], logs: new Map() };
    const w = studentWeek(s, days, d.mamoolaat, d.logs, today);
    const logged = days.filter((day) => day <= today && dayStats(day, d.logs.get(day), d.mamoolaat).hasLog).length;
    const name = s.name ?? '';
    const cls = classNameOf(s);
    rows.push([name, cls, 'ALL', '', ...w.days.map((x) => pctCell(x.completion)), pctCell(w.completion), w.fullDays, logged]);
    for (const pm of w.perMamool) rows.push([name, cls, pm.mamool.name, targetText(pm.mamool), ...pm.cells.map(pctCell), pctCell(pm.completion), '', '']);
    if (d.salah) for (const r of salahRows(d.salah, days, today, [name, cls])) rows.push([r[0], r[1], `Salah: ${r[2]}`, '', ...r.slice(3, -1), `${r[r.length - 1]} in jamaat`, '', '']);
  }
  return rows;
}

/** A single student's detailed log for a range: what was logged for each mamool on each day. */
export function studentDetailRows(mamoolaat: Mamool[], logs: Map<string, DayLog>, days: string[], today: string): Cell[][] {
  const inRange = mamoolaat.filter((m) => days.some((d) => scheduledFor(d, [m]).length));
  const rows: Cell[][] = [['Mamool', 'Target', ...days, 'Overall %']];
  for (const m of inRange) {
    rows.push([
      m.name,
      targetText(m),
      ...days.map((d) => {
        if (d > today || !scheduledFor(d, [m]).length) return '';
        const e = logs.get(d)?.entries[m.id];
        if (!e) return 'not logged';
        if (e.status === 'done') return 'done';
        if (e.status === 'missed') return 'missed';
        return `${e.amount}/${e.target} (${Math.round(entryFraction(e) * 100)}%)`;
      }),
      pctCell(mamoolCompletion(m, days, logs, today, mamoolaat)),
    ]);
  }
  rows.push([
    'ALL',
    '',
    ...days.map((d) => {
      if (d > today) return '';
      const s = dayStats(d, logs.get(d), mamoolaat);
      return s.scheduled ? Math.round(s.completion * 100) : '';
    }),
    pctCell(periodCompletion(days, logs, mamoolaat, today)),
  ]);
  return rows;
}

export const fileSafe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '') || 'export';
