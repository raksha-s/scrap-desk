import { describe, expect, it } from 'vitest';
import { folder, page, card } from '../test/fixtures';
import { peekImageId, syncStage, type SyncTarget } from './sync';
import type { StageFolder } from './Stage';

const f = (id: string, extra: Partial<StageFolder> = {}): StageFolder => ({ id, name: id, skin: 'f03', pages: 0, peek: null, ...extra });
function fake() {
  const calls: unknown[][] = [];
  const stage: SyncTarget = {
    setFolders: (list) => calls.push(['all', list.map((x) => x.id)]),
    rename: (i, name) => calls.push(['rename', i, name]),
    recolor: (i, skin) => calls.push(['recolor', i, skin]),
    setContent: (i, c) => calls.push(['content', i, c]),
  };
  return { stage, calls };
}
const run = (before: StageFolder[] | null, after: StageFolder[]) => { const s = fake(); syncStage(s.stage, before, after); return s.calls; };

describe('keeping the 3D desk in step', () => {
  it('builds the stack the first time and when folders come or go', () => {
    expect(run(null, [f('a')])).toEqual([['all', ['a']]]);
    expect(run([f('a')], [f('a'), f('b')])).toEqual([['all', ['a', 'b']]]);
    expect(run([f('a'), f('b')], [f('b')])).toEqual([['all', ['b']]]);
  });
  it('changes only what changed', () => {
    const before = [f('a'), f('b')];
    expect(run(before, [f('a'), f('b')])).toEqual([]);
    expect(run(before, [f('a'), f('b', { name: 'New' })])).toEqual([['rename', 1, 'New']]);
    expect(run(before, [f('a', { skin: 'f10' }), f('b')])).toEqual([['recolor', 0, 'f10']]);
    expect(run(before, [f('a'), f('b', { pages: 1, peek: { src: 'blob:x' } })])).toEqual([['content', 1, { pages: 1, peek: { src: 'blob:x' } }]]);
  });
});

it('peeks the newest photo or camera shot in a folder, never an album cover', () => {
  const pages = [
    page('old', 'f', [card('a')], 1),
    page('new', 'f', [card('b', 'img-b'), card('c', 'img-c', 'camera'), card('d', 'img-d', 'album')], 3),
    page('other', 'g', [card('e')], 9),
    page('newest-without-photos', 'f', [], 5),
  ];
  expect(peekImageId(pages, 'f')).toBe('img-c');
  expect(peekImageId(pages, 'empty')).toBeNull();
  expect(folder('f').id).toBe('f');
});
