import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Dialog as RDialog } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { CaretDown, CaretRight, X, type Icon } from '@phosphor-icons/react';
import { cn } from '../lib/cn';

/**
 * The quiet building blocks, modelled on how the Bilal app is used:
 *  - one big answer per screen (Hero) with one clay call to action (Cta),
 *  - everything else as a hairline row that either opens somewhere (Row ›)
 *    or expands in place (Disclosure ⌄),
 *  - secondary tasks in a bottom sheet with a grab handle (Sheet).
 * One easing curve everywhere, short durations, nothing bounces.
 */
export const EASE = [0.22, 0.8, 0.25, 1] as const;

/** The screen's one answer: a small label, a large Prata value, and a line of context. */
export function Hero({ label, children, sub, className = '' }: { label?: ReactNode; children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <div className="text-[15px] text-slate-600">{label}</div>}
      <motion.div
        className="mt-1.5 font-serif text-[44px] leading-[1.05] tracking-[-0.01em] break-words text-slate-900"
        dir="auto"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: EASE }}
      >
        {children}
      </motion.div>
      {sub && <div className="mt-3 text-[15px] text-slate-600">{sub}</div>}
    </div>
  );
}

/** The single solid action on a screen: clay, with its icon in a divided end cap. */
export function Cta({ children, icon: Glyph, onClick, to, disabled }: { children: ReactNode; icon: Icon; onClick?: () => void; to?: string; disabled?: boolean }) {
  const cls =
    'group flex min-h-14 w-full items-stretch overflow-hidden rounded-md bg-primary text-[16px] text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.33),inset_0_-1px_0_rgb(64_46_34/0.16)] transition-[background-color,transform] duration-150 ease-calm hover:bg-primary-strong active:scale-[0.99] disabled:opacity-50';
  const inner = (
    <>
      <span className="flex flex-1 items-center px-5">{children}</span>
      <span className="flex w-14 items-center justify-center border-l border-on-primary/15">
        <Glyph size={20} weight="regular" aria-hidden className="transition-transform duration-200 ease-calm group-hover:translate-x-0.5" />
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

const rowCls = 'flex min-h-[3.75rem] w-full items-center justify-between gap-3 py-3 text-left text-[15px] text-slate-900';

/** A row that goes somewhere (a page, or a sheet via onClick). */
export function Row({ children, sub, to, onClick, end }: { children: ReactNode; sub?: ReactNode; to?: string; onClick?: () => void; end?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block">{children}</span>
        {sub && <span className="mt-0.5 block truncate text-[13px] text-slate-500">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-slate-500">
        {end}
        <CaretRight size={16} aria-hidden className="transition-transform duration-200 ease-calm group-hover:translate-x-0.5" />
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={cn('group', rowCls)}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cn('group', rowCls)}>
      {body}
    </button>
  );
}

/** A row that expands in place. */
export function Disclosure({
  title,
  sub,
  defaultOpen = false,
  children,
  end,
}: {
  title: ReactNode;
  sub?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  end?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={rowCls}>
        <span className="min-w-0">
          <span className="block">{title}</span>
          {sub && <span className="mt-0.5 block truncate text-[13px] text-slate-500">{sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-slate-500">
          {end}
          <CaretDown size={16} aria-hidden className={cn('transition-transform duration-200 ease-calm', open && 'rotate-180')} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.24, ease: EASE }, opacity: { duration: 0.17 } }}
          >
            <div className="pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A stack of rows divided by hairlines. */
export function Rows({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-slate-200 border-y border-slate-200', className)}>{children}</div>;
}

/** A bottom sheet with a grab handle (Radix Dialog underneath, so focus and Escape just work). */
export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="pb-safe fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[88dvh] max-w-3xl overflow-y-auto rounded-t-2xl bg-surface px-5 pt-2.5 shadow-2xl sm:bottom-4 sm:max-w-lg sm:rounded-2xl"
                initial={{ y: '100%', opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0.6 }}
                transition={{ y: { duration: 0.26, ease: EASE }, opacity: { duration: 0.16 } }}
              >
                <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-slate-300" />
                <div className="mt-4 mb-4 flex items-center justify-between gap-3">
                  <RDialog.Title className="font-serif text-[28px] leading-tight text-slate-900">{title}</RDialog.Title>
                  <RDialog.Close className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:text-slate-900" aria-label="Close">
                    <X size={20} />
                  </RDialog.Close>
                </div>
                <div className="pb-6">{children}</div>
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

/** Opening screen while the session loads: the mark and the name settle in, then a status line. */
export function Splash({ status }: { status?: string }) {
  return (
    <div className="pt-safe relative isolate flex min-h-dvh flex-col items-center justify-center px-6" role="status">
      <div aria-hidden className="sky sky-static pointer-events-none absolute inset-0 -z-10" />
      <motion.img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        className="h-14 w-14 rounded-[12px]"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.76, ease: EASE }}
      />
      <motion.div className="mt-5 font-serif text-[34px] text-slate-900" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.62, delay: 0.18, ease: EASE }}>
        Mamūlāt
      </motion.div>
      <motion.div className="mt-2 text-sm text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.52, delay: 0.5 }}>
        {status ?? 'Opening…'}
      </motion.div>
    </div>
  );
}
