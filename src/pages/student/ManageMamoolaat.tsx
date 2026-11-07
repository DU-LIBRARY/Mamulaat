import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { MamoolEditor } from '../../components/MamoolEditor';

export function ManageMamoolaat() {
  const { profile, today, actor } = useActiveSession();
  const { all } = useMyData();
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">My mamoolaat</h2>
      <p className="mb-4 text-sm text-slate-500">Changes apply from today. Past days keep their history.</p>
      <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
    </div>
  );
}
