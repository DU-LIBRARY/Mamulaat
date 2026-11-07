import { useActiveSession } from '../../hooks/useSession';
import { useMyData } from '../../hooks/useStudentData';
import { MamoolEditor } from '../../components/MamoolEditor';
import { updateOwnProfile } from '../../lib/db';
import { PrivacyNote } from '../../components/PrivacyNote';

export function Onboarding() {
  const { profile, today, actor } = useActiveSession();
  const { all, active } = useMyData();
  return (
    <div className="mx-auto max-w-xl p-4 pb-16">
      <h1 className="mt-4 text-2xl font-extrabold text-brand-900">Assalamu alaykum{profile.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋</h1>
      <p className="mt-1 mb-4 text-slate-600">
        Let's set up your daily mamoolaat. Type in your own list — everyone's is different. You can add, edit or remove
        them later. Arabic and Urdu are fine.
      </p>
      <MamoolEditor uid={profile.id} all={all} today={today} actor={actor} showSuggestions />
      <button className="btn-primary mt-6 w-full text-lg" disabled={active.length === 0} onClick={() => updateOwnProfile(profile.id, { onboarded: true })}>
        {active.length ? `Start with ${active.length} mamool${active.length > 1 ? 'aat' : ''} →` : 'Add at least one mamool'}
      </button>
      <div className="mt-6">
        <PrivacyNote compact />
      </div>
    </div>
  );
}
