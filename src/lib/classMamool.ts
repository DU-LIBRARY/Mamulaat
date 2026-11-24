import { norm, sameMamoolName } from './names';
import type { Mamool, TemplateItem } from '../types';

/**
 * Keeping a student's class mamoolaat in step with their class.
 *
 * Class mamoolaat are marked with `fromClass` on the student's list. Whatever the class's list
 * is now, the student has exactly those (same name, target and unit); class mamoolaat of any
 * other class (or of a class they've left) are removed (soft: history stays). Personal mamoolaat
 * are never touched. Pure, so it can be tested and run from the student's app or the admin's.
 */
export type ClassMamoolOp =
  | { kind: 'add'; id: string; input: TemplateItem; order: number }
  | { kind: 'update'; m: Mamool; patch: Partial<Pick<Mamool, 'name' | 'target' | 'unit' | 'fromClass' | 'classItem' | 'active' | 'removedDate' | 'gaps'>>; restored: boolean }
  | { kind: 'remove'; m: Mamool };

/** One id per class and mamool name, so leaving and rejoining a class brings back the same one. */
export function classMamoolId(classId: string, name: string) {
  let h = 0x811c9dc5;
  for (const ch of norm(name)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `cls_${classId}_${h.toString(36)}`;
}

export function planClassMamoolaat(existing: Mamool[], template: TemplateItem[] | null, classId: string | null, uid: string, today: string): ClassMamoolOp[] {
  const ops: ClassMamoolOp[] = [];
  const kept = new Set<string>();
  let order = existing.reduce((mx, m) => Math.max(mx, (m.order ?? 0) + 1), 0);
  const ids = new Set(existing.map((m) => m.id));

  for (const t of classId ? (template ?? []) : []) {
    const fields = { name: t.name, target: t.target, unit: t.unit ?? '' };
    const same = (a: TemplateItem, b: TemplateItem) => a.name === b.name && a.target === b.target && (a.unit ?? '') === (b.unit ?? '');
    // Matched on the class's name for it, so a student who renamed theirs keeps it.
    const mine = existing.find((m) => m.fromClass === classId && !kept.has(m.id) && sameMamoolName(m.classItem?.name ?? m.name, t.name));
    if (mine) {
      kept.add(mine.id);
      // The student changed theirs (e.g. a bigger target): keep their version.
      const custom = !!mine.classItem && !same(mine, mine.classItem);
      const own = custom ? {} : fields;
      if (!mine.active) {
        const gaps = [...(mine.gaps ?? [])];
        if (mine.removedDate && mine.removedDate < today) gaps.push({ from: mine.removedDate, to: today });
        ops.push({ kind: 'update', m: mine, patch: { ...own, classItem: fields, active: true, removedDate: null, gaps: gaps.slice(-50) }, restored: true });
      } else if (!mine.classItem || !same(mine.classItem, fields) || (!custom && !same(mine, fields))) {
        ops.push({ kind: 'update', m: mine, patch: { ...own, classItem: fields }, restored: false });
      }
      continue;
    }
    // Added by the teacher before class mamoolaat were tracked: it becomes the class one.
    const legacy = existing.find((m) => !m.fromClass && m.active && m.createdBy !== uid && !kept.has(m.id) && sameMamoolName(m.name, t.name));
    if (legacy) {
      kept.add(legacy.id);
      ops.push({ kind: 'update', m: legacy, patch: { ...fields, fromClass: classId, classItem: fields }, restored: false });
      continue;
    }
    // The student already has their own with this name: keep theirs, don't add a second.
    if (existing.some((m) => !m.fromClass && m.active && sameMamoolName(m.name, t.name))) continue;
    const id = classMamoolId(classId!, t.name);
    if (ids.has(id)) continue; // (a name that normalises the same as one already handled)
    ids.add(id);
    ops.push({ kind: 'add', id, input: fields, order: order++ });
  }

  for (const m of existing) if (m.fromClass && m.active && !kept.has(m.id)) ops.push({ kind: 'remove', m });
  return ops;
}
