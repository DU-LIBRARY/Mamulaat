import { IconX } from './icons';

/** A foreground push message, shown at the top of the screen. */
export function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="alert" className="top-safe-toast fixed inset-x-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink py-3 pr-2 pl-4 text-sm text-[#f1eee4] shadow-xl">
      <span className="flex-1">{text}</span>
      <button className="btn min-h-11 px-2 text-white/80 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Dismiss">
        <IconX size={18} />
      </button>
    </div>
  );
}
