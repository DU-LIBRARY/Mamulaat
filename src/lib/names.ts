import type { Mamool } from '../types';

const norm = (x: string) => x.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]+/gu, '');

/** Names are compared loosely so "Tasbeeh" and " tasbeeh. " count as the same mamool. */
export function sameMamoolName(a: string, b: string) {
  return norm(a) === norm(b);
}

/** Loose "is this probably the same practice?" check, used to point out overlaps. */
export function similarMamoolName(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x));
}

/** For each active mamool, another active one it looks like (if any). */
export function findOverlaps(active: Pick<Mamool, 'id' | 'name'>[]): Map<string, Pick<Mamool, 'id' | 'name'>> {
  const out = new Map<string, Pick<Mamool, 'id' | 'name'>>();
  active.forEach((m, i) =>
    active.forEach((o, j) => {
      if (i !== j && !out.has(m.id) && similarMamoolName(m.name, o.name)) out.set(m.id, o);
    }),
  );
  return out;
}
