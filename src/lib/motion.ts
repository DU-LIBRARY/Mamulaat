import type { Transition } from 'motion/react';

/**
 * The app's motion, in one place. Springs rather than fixed-length curves: they start at
 * the speed of the finger, ease out without a hard stop, and pick up smoothly if
 * interrupted mid-way (tap a row twice and it reverses instead of jumping). No bounce,
 * so things settle the way iOS sheets and lists do.
 */

/** Things that move or change size: sheets, rows opening, pages settling in. */
export const glide: Transition = { type: 'spring', bounce: 0, visualDuration: 0.38 };

/** Small, quick changes: icons swapping, a toast arriving. */
export const snap: Transition = { type: 'spring', bounce: 0, visualDuration: 0.26 };

/** Fades that ride along with a spring. */
export const fade: Transition = { duration: 0.2, ease: [0.22, 0.8, 0.25, 1] };

/** A height animation (0 ↔ auto) for content opening in place: size glides, content fades. */
export const expand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { height: glide, opacity: fade } satisfies Transition,
};
