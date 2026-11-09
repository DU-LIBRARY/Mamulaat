import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { MamoolEditor } from '../../components/MamoolEditor';

export function ManageMamoolaat() {
  const { profile, today, actor } = useActiveSession();
  const { all } = useMyData();
  return (
    <div>
      <h1 className="display mb-2 pt-5 text-[34px] leading-tight">My mamoolaat</h1>
      <p className="mb-4 text-sm text-slate-500">Changes apply from today. Past days keep their history.</p>
      <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
    </div>
  );
}
