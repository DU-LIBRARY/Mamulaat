import { IconLock } from './icons';

export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 ${compact ? 'p-3' : 'p-4'}`}>
      <IconLock size={18} className="mt-0.5 shrink-0 text-slate-400" />
      <div>
        <div className="font-medium text-slate-800">Who can see your data</div>
        <p className="mt-1 leading-relaxed">
          Your mamoolaat, daily logs and streaks are visible only to you and the admin (the asaatidhah). Other students can never see them.
        </p>
      </div>
    </div>
  );
}
