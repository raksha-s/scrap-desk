import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { memoryRepo } from '../storage/memory';
import { openRepo, type Repo } from '../storage/repo';
import { card, folder, image, page } from '../test/fixtures';
import { createStore, SAVE_ERROR } from './store';

let n = 0;
const dbName = () => `store-test-${n++}`;

// a real repository whose writes can be made to fail, as when storage is full
function flaky() {
  const inner = memoryRepo(); const state = { broken: false };
  const guard = <A extends unknown[]>(fn: (...a: A) => Promise<void>) => async (...a: A) => {
    if (state.broken) throw new DOMException('full', 'QuotaExceededError');
    return fn(...a);
  };
  const repo: Repo = { ...inner, putFolder: guard(inner.putFolder), putPage: guard(inner.putPage), deletePage: guard(inner.deletePage), deleteFolder: guard(inner.deleteFolder) };
  return { repo, inner, state };
}
async function ready(repo: Repo) { const s = createStore(async () => repo); await s.init(); return s; }

describe('store', () => {
  it('words the save failure as agreed', () => {
    expect(SAVE_ERROR).toBe("Couldn't save. Your browser is blocking storage or has run out of space, so changes may be lost when you close this tab.");
  });

  it('seeds one empty Unnamed Folder on first run only', async () => {
    const db = dbName(); const s = createStore(() => openRepo(db));
    await Promise.all([s.init(), s.init()]);
    expect(s.get().ready).toBe(true);
    expect(s.get().folders.map((f) => [f.name, f.skin])).toEqual([['Unnamed Folder', 'f03']]);
    s.deleteFolder(s.get().folders[0].id); await s.flush();
    const again = createStore(() => openRepo(db)); await again.init();
    expect(again.get().folders).toEqual([]);
  });

  it('keeps folders, renames and recolours across a reload', async () => {
    const db = dbName(); const s = createStore(() => openRepo(db)); await s.init();
    const f = s.addFolder('Trips');
    s.renameFolder(f.id, 'Mountains'); s.recolorFolder(f.id, 'f10'); await s.flush();
    const again = createStore(() => openRepo(db)); await again.init();
    expect(again.get().folders.map((x) => [x.name, x.skin])).toEqual([['Unnamed Folder', 'f03'], ['Mountains', 'f10']]);
  });

  it('trims folder names to 28 characters, defaults blank new ones and ignores blank renames', async () => {
    const s = await ready(memoryRepo());
    expect(s.addFolder('   ').name).toBe('Unnamed Folder');
    const f = s.addFolder('x'.repeat(40));
    expect(f.name).toHaveLength(28);
    s.renameFolder(f.id, '  ');
    expect(s.get().folders.at(-1)!.name).toHaveLength(28);
  });

  it('gives each new folder an unused colour', async () => {
    const s = await ready(memoryRepo());
    expect(s.addFolder('a').skin).toBe('f09');
    expect(s.addFolder('b').skin).toBe('f05');
  });

  it('tells subscribers about changes', async () => {
    const s = await ready(memoryRepo()); let calls = 0;
    const off = s.subscribe(() => { calls++; });
    s.addFolder('a'); off(); const seen = calls; s.addFolder('b');
    expect(seen).toBeGreaterThan(0); expect(calls).toBe(seen);
  });

  it('adds a page and its new folder only once saved', async () => {
    const f = flaky(); const s = await ready(f.repo);
    await s.addPage(page('p', 'n', [card('c')]), [image('img-c')], folder('n', 9));
    expect(s.get().pages.map((p) => p.id)).toEqual(['p']);
    expect(s.get().folders.map((x) => x.id)).toContain('n');
  });

  it('adds no page and no folder when the first save fails', async () => {
    const f = flaky(); const s = await ready(f.repo); const before = s.get();
    f.state.broken = true;
    await expect(s.addPage(page('p', 'n'), [], folder('n'))).rejects.toThrow('full');
    expect(s.get().folders).toEqual(before.folders);
    expect(s.get().pages).toEqual([]);
  });

  it('keeps an edit on screen and reports a failed save until that edit is saved', async () => {
    const f = flaky(); const s = await ready(f.repo);
    await s.addPage(page('p', 'n', []), [], folder('n'));
    f.state.broken = true;
    s.updatePage('p', (p) => ({ ...p, cards: [card('c')] }), [image('img-c', 'late')]); await s.flush();
    expect(s.get().pages[0].cards).toHaveLength(1);
    expect(s.get().saveError).toBe(SAVE_ERROR);
    expect(await (await s.image('img-c'))!.blob.text()).toBe('late');       // still visible although unsaved
    s.renameFolder('n', 'other'); await s.flush();
    expect(s.get().saveError).toBe(SAVE_ERROR);
    f.state.broken = false;
    s.renameFolder('n', 'again'); await s.flush();
    expect(s.get().saveError).toBe(SAVE_ERROR);                              // the page is still unsaved
    s.updatePage('p', (p) => ({ ...p, story: 'edited' })); await s.flush();
    expect(s.get().saveError).toBeNull();
    expect(await f.inner.getImage('img-c')).toBeDefined();                   // the image rode along with the retry
  });

  it('saves edits in the order they were made', async () => {
    const db = dbName(); const s = createStore(() => openRepo(db)); await s.init();
    const id = s.get().folders[0].id;
    await s.addPage(page('p', id), []);
    s.updatePage('p', (p) => ({ ...p, story: 'first' }), [image('big', 'x'.repeat(100000))]);
    s.updatePage('p', (p) => ({ ...p, story: 'second' }));
    await s.flush();
    expect((await (await openRepo(db)).load()).pages[0].story).toBe('second');
  });

  it('forgets a deleted page and ignores edits to it', async () => {
    const f = flaky(); const s = await ready(f.repo);
    await s.addPage(page('p', 'n'), [], folder('n'));
    s.deletePage('p'); s.updatePage('p', (p) => ({ ...p, story: 'ghost' })); await s.flush();
    expect(s.get().pages).toEqual([]);
    expect((await f.inner.load()).pages).toEqual([]);
  });

  it('works in memory, with the message, when storage cannot be opened', async () => {
    const s = createStore(async () => { throw new Error('blocked'); }); await s.init();
    expect(s.get().ready).toBe(true);
    expect(s.get().saveError).toBe(SAVE_ERROR);
    s.addFolder('still works'); await s.flush();
    expect(s.get().folders.map((f) => f.name)).toEqual(['Unnamed Folder', 'still works']);
    expect(s.get().saveError).toBe(SAVE_ERROR);
  });
});
