import { describe, expect, it } from 'vitest';
import { classMamoolId, planClassMamoolaat } from '../../src/lib/classMamool';
import type { Mamool } from '../../src/types';

const T = '2026-11-24';
const m = (id: string, name: string, extra: Partial<Mamool> = {}): Mamool => ({
  id, name, target: 1, unit: '', active: true, order: 0, createdBy: 'stu', createdDate: '2026-01-01',
  removedDate: null, updatedBy: 'stu', ...extra,
});

describe('class mamoolaat', () => {
  it('adds the class list to a student who has none of it, after their own', () => {
    const ops = planClassMamoolaat([m('p1', 'Tahajjud', { order: 3 })], [{ name: 'Tasbeeh', target: 100, unit: 'times' }], 'A', 'stu', T);
    expect(ops).toEqual([{ kind: 'add', id: classMamoolId('A', 'Tasbeeh'), input: { name: 'Tasbeeh', target: 100, unit: 'times' }, order: 4 }]);
  });

  it('on a class move, removes the old class ones and keeps personal ones', () => {
    const existing = [m('p1', 'Tahajjud'), m('c1', 'Tasbeeh', { fromClass: 'A' }), m('c2', 'Quran', { fromClass: 'A' })];
    const ops = planClassMamoolaat(existing, [{ name: 'Durood', target: 100, unit: '' }], 'B', 'stu', T);
    expect(ops.filter((o) => o.kind === 'remove').map((o) => (o.kind === 'remove' ? o.m.id : ''))).toEqual(['c1', 'c2']);
    expect(ops.filter((o) => o.kind === 'add')).toHaveLength(1);
    expect(ops.some((o) => 'm' in o && o.m.id === 'p1')).toBe(false);
  });

  it('does nothing when already in step', () => {
    const ci = { name: 'Tasbeeh', target: 100, unit: 'times' };
    const existing = [m('c1', 'Tasbeeh', { fromClass: 'A', target: 100, unit: 'times', classItem: ci })];
    expect(planClassMamoolaat(existing, [{ name: 'Tasbeeh', target: 100, unit: 'times' }], 'A', 'stu', T)).toEqual([]);
  });

  it('follows a change of target, and a removal from the class list', () => {
    const existing = [m('c1', 'Tasbeeh', { fromClass: 'A', target: 100, classItem: { name: 'Tasbeeh', target: 100, unit: '' } }), m('c2', 'Quran', { fromClass: 'A' })];
    const ops = planClassMamoolaat(existing, [{ name: 'Tasbeeh', target: 300, unit: '' }], 'A', 'stu', T);
    const ci = { name: 'Tasbeeh', target: 300, unit: '' };
    expect(ops).toEqual([
      { kind: 'update', m: existing[0], patch: { ...ci, classItem: ci }, restored: false },
      { kind: 'remove', m: existing[1] },
    ]);
  });

  it('rejoining a class brings back the same mamool, with the days away as a gap', () => {
    const old = m('c1', 'Tasbeeh', { fromClass: 'A', active: false, removedDate: '2026-11-01' });
    const ops = planClassMamoolaat([old], [{ name: 'Tasbeeh', target: 1, unit: '' }], 'A', 'stu', T);
    expect(ops).toEqual([{ kind: 'update', m: old, patch: { name: 'Tasbeeh', target: 1, unit: '', classItem: { name: 'Tasbeeh', target: 1, unit: '' }, active: true, removedDate: null, gaps: [{ from: '2026-11-01', to: T }] }, restored: true }]);
  });

  it("keeps a student's own mamool of the same name instead of adding a second", () => {
    expect(planClassMamoolaat([m('p1', 'tasbeeh ')], [{ name: 'Tasbeeh', target: 1, unit: '' }], 'A', 'stu', T)).toEqual([]);
  });

  it('takes over one the teacher added before class mamoolaat were tracked', () => {
    const legacy = m('x', 'Tasbeeh', { createdBy: 'teacher' });
    const ops = planClassMamoolaat([legacy], [{ name: 'Tasbeeh', target: 1, unit: '' }], 'A', 'stu', T);
    expect(ops).toEqual([{ kind: 'update', m: legacy, patch: { name: 'Tasbeeh', target: 1, unit: '', fromClass: 'A', classItem: { name: 'Tasbeeh', target: 1, unit: '' } }, restored: false }]);
  });

  it("keeps a student's bigger version (even renamed) when the class list changes, but still removes it on leaving", () => {
    const ci = { name: 'Tasbeeh', target: 100, unit: 'times' };
    const mine = m('c1', 'Tasbeeh (long)', { fromClass: 'A', target: 500, unit: 'times', classItem: ci });
    expect(planClassMamoolaat([mine], [ci], 'A', 'stu', T)).toEqual([]);
    const ci2 = { name: 'Tasbeeh', target: 200, unit: 'times' };
    expect(planClassMamoolaat([mine], [ci2], 'A', 'stu', T)).toEqual([{ kind: 'update', m: mine, patch: { classItem: ci2 }, restored: false }]);
    expect(planClassMamoolaat([mine], [], 'A', 'stu', T)).toEqual([{ kind: 'remove', m: mine }]);
  });

  it('leaves a class mamool the student removed, and forgets that once they leave the class', () => {
    const out = m('c1', 'Tasbeeh', { fromClass: 'A', active: false, removedDate: '2026-11-01', optedOut: true, classItem: { name: 'Tasbeeh', target: 1, unit: '' } });
    expect(planClassMamoolaat([out], [{ name: 'Tasbeeh', target: 1, unit: '' }], 'A', 'stu', T)).toEqual([]);
    expect(planClassMamoolaat([out], [], 'B', 'stu', T)).toEqual([{ kind: 'update', m: out, patch: { optedOut: null }, restored: false }]);
  });

  it('with no class, removes all class mamoolaat', () => {
    const existing = [m('p1', 'Tahajjud'), m('c1', 'Tasbeeh', { fromClass: 'A' })];
    expect(planClassMamoolaat(existing, null, null, 'stu', T)).toEqual([{ kind: 'remove', m: existing[1] }]);
  });
});
