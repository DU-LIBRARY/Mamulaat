import { doc, query, where } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { db } from '../../firebase';
import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { useCollectionData, useDocData } from '../../hooks/useFirestore';
import { DayChips } from '../../components/DayChips';
import { DateLine } from '../../components/DateLine';
import { SalahChecklist } from '../../components/SalahChecklist';
import { Notice, ProgressRing } from '../../components/ui';
import { Row, Rows } from '../../components/quiet';
import { IconInfo, IconPencil } from '../../components/icons';
import { LockedDayNotice, PendingSyncNotice } from '../../components/LockNotices';
import { isDayEditable, isValidYmd, lastEditableDay } from '../../lib/dates';
import { classesCol, saveSalah, saveSalahEntries } from '../../lib/db';
import { salahStats } from '../../lib/salah';
import { SALAH_NAMES, type ClassDoc, type SalahName, type SalahStatus } from '../../types';
import { Check } from '@phosphor-icons/react';
import { Cta } from '../../components/quiet';
import { useUndo } from '../../components/Undo';

/** The student's class doc (name and Fajr monitor), or null when they have no class. */
export function useMyClass() {
  const { profile } = useActiveSession();
  const id = profile.classId;
  return useDocData<ClassDoc>(id ? doc(db, 'classes', id) : null, `class:${id ?? ''}`).data;
}

/** The classes whose Fajr roll this student may see (the admin made them its Fajr monitor). */
export function useMonitoredClasses() {
  const { profile } = useActiveSession();
  const r = useCollectionData<ClassDoc>(query(classesCol(), where('fajrMonitorId', '==', profile.id)), `monitored:${profile.id}`);
  const data = [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return { ...r, data };
}

export function Salah() {
  const { profile, today, settings } = useActiveSession();
  const { salah } = useMyData();
  const cls = useMyClass();
  const monitored = useMonitoredClasses().data;
  const params = useParams();
  const day = params.day && isValidYmd(params.day) && params.day <= today ? params.day : today;
  const editable = isDayEditable(day, today, settings.backfillDays);
  const record = salah.get(day);
  const s = salahStats(record);
  const monitorId = cls?.fajrMonitorId ?? null;
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

      {isMonitor && (
        <Notice icon={<IconInfo size={18} />}>
          As Fajr monitor, you can see each student’s Fajr status in the classes you look after. Nothing else of theirs is shared with you.
        </Notice>
      )}
      {monitorId && monitorId !== profile.id && (
        <Notice icon={<IconInfo size={18} />}>
          Your Fajr status is shared with your class’s Fajr monitor{cls?.fajrMonitorName ? `, ${cls.fajrMonitorName}` : ''}. Your other salah and your mamoolaat stay between you and your teacher.
        </Notice>
      )}
    </div>
  );
}
