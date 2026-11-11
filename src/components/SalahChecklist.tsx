import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'motion/react';
import { expand, fade, snap } from '../lib/motion';
import { SALAH_NAMES, type SalahDay, type SalahName, type SalahStatus } from '../types';
import { SALAH_LABEL, STATUS_DESC, STATUS_LABEL } from '../lib/salah';
import { IconCheck, IconClock, IconUsers, IconX } from './icons';
import { useUndo } from './Undo';

/** Same anatomy as a mamool row: Takbir is the circle you tick, the rest are quiet text buttons. */
const button = cva(
  'relative inline-flex items-center justify-center transition-[background-color,border-color,color] duration-300 ease-calm disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      status: { takbir: '', jamaat: '', qadha: '', missed: '' },
      on: { true: '', false: '' },
      layout: {
        circle: 'h-11 w-11 shrink-0 rounded-full border',
        text: '-ml-2 min-h-11 gap-1.5 rounded-md px-2 text-[13px]',
      },
    },
    compoundVariants: [
      { layout: 'circle', on: false, class: 'border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-700' },
      { layout: 'circle', on: true, class: 'border-primary bg-primary text-on-primary' },
      { layout: 'text', on: false, class: 'text-slate-500 hover:text-slate-800' },
      { layout: 'text', status: 'jamaat', on: true, class: 'text-brand-700' },
      { layout: 'text', status: 'qadha', on: true, class: 'text-amber-800' },
      { layout: 'text', status: 'missed', on: true, class: 'text-red-800' },
    ],
  },
);

const ICON: Record<Exclude<SalahStatus, 'takbir'>, ReactNode> = {
  jamaat: <IconUsers size={16} />,
  qadha: <IconClock size={16} />,
  missed: <IconX size={16} />,
};

function edge(status: SalahStatus | undefined) {
  if (status === 'takbir') return 'before:bg-brand-700';
  if (status === 'jamaat') return 'before:bg-brand-300';
  if (status === 'qadha') return 'before:bg-amber-500';
  if (status === 'missed') return 'before:bg-red-400';
  return 'before:bg-transparent';
}

const subClass: Record<SalahStatus, string> = {
  takbir: 'text-brand-700',
  jamaat: 'text-brand-700',
  qadha: 'text-amber-800',
  missed: 'text-red-800',
};

function SalahRow({
  name,
  status,
  editable,
  onChange,
}: {
  name: SalahName;
  status: SalahStatus | undefined;
  editable: boolean;
  onChange: (s: SalahStatus | null) => void;
}) {
  const undo = useUndo();
  const label = SALAH_LABEL[name];
  const set = (s: SalahStatus) => {
    if (!editable) return;
    if (status === s) {
      const prev = status;
      onChange(null);
      undo.undoable(`Cleared ${label}`, () => onChange(prev));
    } else onChange(s);
  };

  return (
    <li className={`relative py-4 before:absolute before:inset-y-4 before:-left-3 before:w-[3px] before:rounded-r-full before:transition-colors ${edge(status)}`}>
      <span className="sr-only" aria-live="polite">
        {label}: {status ? STATUS_DESC[status] : 'not logged'}
      </span>
      <div className="flex items-center gap-3" role="group" aria-label={`${label} status`}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] leading-snug text-slate-900">{label}</div>
          <div className={`mt-0.5 text-sm ${status ? subClass[status] : 'text-slate-500'}`}>{status ? STATUS_DESC[status] : 'Not logged'}</div>
          <AnimatePresence initial={false}>
            {status !== 'takbir' && (
              <motion.div key="chips" className="overflow-hidden" {...expand}>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {(['jamaat', 'qadha', 'missed'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!editable}
                      aria-pressed={status === s}
                      onClick={() => set(s)}
                      className={button({ status: s, on: status === s, layout: 'text' })}
                    >
                      {ICON[s]}
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            disabled={!editable}
            aria-pressed={status === 'takbir'}
            aria-label={`${label}: ${STATUS_DESC.takbir}`}
            title={STATUS_DESC.takbir}
            onClick={() => set('takbir')}
            className={button({ status: 'takbir', on: status === 'takbir', layout: 'circle' })}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={String(status === 'takbir')}
                className="inline-flex"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: fade }}
                transition={snap}
              >
                <IconCheck size={20} weight={status === 'takbir' ? 'bold' : 'regular'} />
              </motion.span>
            </AnimatePresence>
          </button>
          <span aria-hidden className="text-[11px] text-slate-500">
            Takbir
          </span>
        </div>
      </div>
    </li>
  );
}

export function SalahChecklist({
  day,
  record,
  editable,
  onChange,
}: {
  day: string;
  record: SalahDay | undefined;
  editable: boolean;
  onChange: (name: SalahName, status: SalahStatus | null) => void;
}) {
  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200" aria-label="Salah">
      {SALAH_NAMES.map((n) => (
        <SalahRow key={n + day} name={n} status={record?.entries?.[n]} editable={editable} onChange={(s) => onChange(n, s)} />
      ))}
    </ul>
  );
}
