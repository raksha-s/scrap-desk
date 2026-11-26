import { describe, expect, it, vi } from 'vitest';
import { ruleDirector } from '../../engine/director';
import { memoryRepo } from '../../storage/memory';
import { image } from '../../test/fixtures';
import { readyStore } from '../../test/render';
import { emptyDraft, type Draft } from './form';
import { generatePage, SaveFailed } from './generate';

const draft = (extra: Partial<Draft> = {}): Draft => ({ ...emptyDraft('new'), newName: 'Trips', kind: 'range', start: '2026-11-01', end: '2026-11-30', story: '  A happy, warm month with friends. I will cherish it.  ', photos: [{ ...image('m1'), url: 'blob:1' }], ...extra });
const deps = (store: Awaited<ReturnType<typeof readyStore>>) => ({ store, director: ruleDirector, measureNote: () => 200 });

describe('generating a page', () => {
  it('saves page, images and new folder together', async () => {
    const repo = memoryRepo(); const put = vi.spyOn(repo, 'putPage'); const store = await readyStore(repo);
    const page = await generatePage(draft(), deps(store));
    expect(put).toHaveBeenCalledTimes(1);
    const [, extra] = put.mock.calls[0];
    expect(extra!.folder!.name).toBe('Trips');
    expect(extra!.images!.map((i) => i.id)).toEqual(['m1']);
    expect(extra!.images![0]).not.toHaveProperty('url');
    expect(page.folderId).toBe(extra!.folder!.id);
    expect(page).toMatchObject({ start: '2026-11-01', end: '2026-11-30', story: 'A happy, warm month with friends. I will cherish it.' });
    expect(page.cards).toEqual([expect.objectContaining({ kind: 'photo', imageId: 'm1', w: 40, h: 30 })]);
    expect(page.items.some((i) => i.type === 'photo')).toBe(true);
    expect(store.get().pages.map((p) => p.id)).toEqual([page.id]);
  });

  it('uses the chosen folder, and one date means one day', async () => {
    const store = await readyStore(); const id = store.get().folders[0].id;
    const page = await generatePage(draft({ folder: id, kind: 'day', start: '2026-11-09', end: '2026-11-30' }), deps(store));
    expect([page.folderId, page.start, page.end]).toEqual([id, '2026-11-09', '2026-11-09']);
    expect(store.get().folders).toHaveLength(1);
  });

  it('leaves nothing behind when saving fails', async () => {
    const repo = memoryRepo(); const store = await readyStore(repo); const before = store.get().folders;
    vi.spyOn(repo, 'putPage').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    const d = draft(); const copy = { ...d };
    await expect(generatePage(d, deps(store))).rejects.toBeInstanceOf(SaveFailed);
    expect(store.get().folders).toEqual(before);
    expect(store.get().pages).toEqual([]);
    expect(d).toEqual(copy);
  });

  const said = async (d: Draft) => {
    const store = await readyStore(); const lines: [string, number][] = [];
    await generatePage(d, { ...deps(store), onStep: async (line, _sub, _chips, ms) => { lines.push([line, ms]); } });
    return lines;
  };
  it('narrates like the prototype', async () => {
    expect(await said(draft())).toEqual([['Reading your story…', 650], ['Feeling it out', 1150], ['Choosing flowers, seals & tape', 800], ['Arranging the page…', 450]]);
    expect(await said(draft({ story: '' }))).toEqual([['No words yet — letting the photos lead…', 700], ['Choosing flowers, seals & tape', 800], ['Arranging the page…', 450]]);
  });
});
