import { query, where } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { useActiveSession } from '../../hooks/useSession';
import { useLoadFrom, useMyData } from '../../hooks/useStudentData';
import { useCollectionData } from '../../hooks/useFirestore';
import { DayChips } from '../../components/DayChips';
import { DateLine } from '../../components/DateLine';
import { SalahChecklist } from '../../components/SalahChecklist';
import { Notice, ProgressRing } from '../../components/ui';
import { Row, Rows } from '../../components/quiet';
import { IconPencil } from '../../components/icons';
import { LockedDayNotice, PendingSyncNotice, LostEntriesNotice } from '../../components/LockNotices';
import { isDayEditable, isValidYmd, lastEditableDay } from '../../lib/dates';
import { classesCol, saveSalah, saveSalahEntries } from '../../lib/db';
import { salahStats } from '../../lib/salah';
import { SALAH_NAMES, type ClassDoc, type SalahName, type SalahStatus } from '../../types';
import { Check } from '@phosphor-icons/react';
import { Cta } from '../../components/quiet';
import { useUndo } from '../../components/Undo';

/** The classes whose Fajr roll this student may see (the admin made them its Fajr monitor). */
export function useMonitoredClasses() {
  const { profile } = useActiveSession();
  const r = useCollectionData<ClassDoc>(query(classesCol(), where('fajrMonitorId', '==', profile.id)), `monitored:${profile.id}`);
  const data = [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return { ...r, data };
}

/** The classes whose weekend salah this student may see (the staff made them its weekend rep). */
export function useRepClasses() {
  const { profile } = useActiveSession();
  const r = useCollectionData<ClassDoc>(query(classesCol(), where('weekendRepId', '==', profile.id)), `repOf:${profile.id}`);
  const data = [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return { ...r, data };
}

export function Salah() {
  const { profile, today, settings } = useActiveSession();
  const data = useMyData();
  const { salah } = data;
  const monitored = useMonitoredClasses().data;
  const repOf = useRepClasses().data;
  const params = useParams();
  const day = params.day && isValidYmd(params.day) && params.day <= today ? params.day : today;
  useLoadFrom(data, day);
  const editable = isDayEditable(day, today, settings.backfillDays);
  const record = salah.get(day);
  const s = salahStats(record);
  const isMonitor = monitored.length > 0;
  const owner = { uid: profile.id, name: profile.name ?? profile.email, classId: profile.classId };
  const undo = useUndo();
  // Only the salah still empty become Jamaat; anything already marked is kept.
  const remaining = SALAH_NAMES.filter((n) => !record?.entries?.[n]);
  const markRest = () => {
    const next: Partial<Record<SalahName, SalahStatus | null>> = {};
    const prev: Partial<Record<SalahName, SalahStatus | null>> = {};
    for (const n of remaining) {
      next[n] = 'jamaat';
      prev[n] = null;
    }
    saveSalahEntries(owner, day, next);
    undo.undoable(`Marked ${remaining.length} as Jamaat`, () => saveSalahEntries(owner, day, prev));
  };

  return (
    <div className="flex flex-col gap-4">
      <LostEntriesNotice />
      <PendingSyncNotice />
      <DayChips day={day} today={today} backfillDays={settings.backfillDays} hrefFor={(d) => (d === today ? '/salah' : `/salah/${d}`)} />

      <div className="flex items-center justify-between">
        <DateLine day={day} size="lg" />
        <ProgressRing value={s.inJamaat / 5} label={`${s.inJamaat}/5`} />
      </div>
      <p className="-mt-2 text-[13px] text-slate-500">
        <span className="num">{s.inJamaat}</span> of 5 in jamaat
        {s.qadha ? <span className="num"> · {s.qadha} qadha</span> : null}
        {s.missed ? <span className="num"> · {s.missed} missed</span> : null}
      </p>

      <LockedDayNotice day={day} />
      {editable && day !== today && lastEditableDay(day, settings.backfillDays) === today && (
        <Notice tone="warn">Last chance: this day locks at midnight tonight.</Notice>
      )}
      {record?.editedBy && (
        <Notice tone="teacher" icon={<IconPencil size={18} />}>
          Your teacher{record.editedByName ? ` (${record.editedByName})` : ''} edited this day.
        </Notice>
      )}

      {editable && remaining.length > 0 && (
        <Cta icon={Check} onClick={markRest}>
          {remaining.length === 5 ? 'Mark all as Jamaat' : `Mark the other ${remaining.length} as Jamaat`}
        </Cta>
      )}

      <SalahChecklist day={day} record={record} editable={editable} onChange={(name, status) => saveSalah(owner, day, name, status)} />
      {editable && <p className="text-center text-xs text-slate-500">Tick if you prayed in jamaat; tap Takbir Ula if you joined from the first takbir. Tap again to undo.</p>}

      {isMonitor && (
        <Rows className="mt-2">
          <Row to={`/salah/fajr${day === today ? '' : `?date=${day}`}`} sub="Who missed Fajr, prayed qadha or hasn’t logged">
            Fajr roll · {monitored.length === 1 ? monitored[0].name : `${monitored.length} classes`}
          </Row>
        </Rows>
      )}

      {repOf.length > 0 && (
        <Rows className={isMonitor ? '' : 'mt-2'}>
          {repOf.map((c) => (
            <Row key={c.id} to={`/salah/weekend?class=${c.id}`} sub="Everyone’s Saturday and Sunday salah on one sheet, to screenshot and send">
              Weekend salah · {c.name}
            </Row>
          ))}
        </Rows>
      )}
    </div>
  );
}
