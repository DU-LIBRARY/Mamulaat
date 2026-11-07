import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { MamoolEditor } from '../../components/MamoolEditor';

export function ManageMamoolaat() {
  const { profile, today, actor } = useActiveSession();
  const { all } = useMyData();
  return (
    <div>
      <h1 className="mb-1 text-[22px] font-semibold tracking-[-0.015em] text-slate-900">My mamoolaat</h1>
      <p className="mb-4 text-sm text-slate-500">Changes apply from today. Past days keep their history.</p>
      <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
    </div>
  );
}
