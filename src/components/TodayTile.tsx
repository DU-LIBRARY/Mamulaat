import { AnimatePresence, motion } from 'motion/react';
import { DateLine } from './DateLine';
import { Girih, SegmentBar } from './ui';

/**
 * Today's header: the one glazed cobalt tile on the screen. Greeting, the date in both
 * calendars, the count done, and today's mamoolaat as a strand of gold beads.
 */
export function TodayTile({ name, day, done, scheduled, fractions }: { name?: string; day: string; done: number; scheduled: number; fractions: number[] }) {
  const first = name?.split(' ')[0];
  return (
    <header className="tile px-5 pt-4 pb-5">
      <Girih className="text-white/[0.09]" />
      <div className="text-sm text-white/75" dir="auto">
        Assalamu alaykum{first ? `, ${first}` : ''}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-4">
        <DateLine day={day} size="lg" onTile />
        {scheduled > 0 && (
          <div className="shrink-0 text-right">
            <div className="num flex items-baseline justify-end text-[34px] leading-none font-semibold tracking-[-0.03em]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={done}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                >
                  {done}
                </motion.span>
              </AnimatePresence>
              <span className="text-[22px] text-white/50">/{scheduled}</span>
            </div>
            <div className="mt-1 text-xs text-white/70">done today</div>
          </div>
        )}
      </div>
      <SegmentBar className="mt-5" onTile fractions={fractions} />
    </header>
  );
}
