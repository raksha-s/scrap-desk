import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openRepo, type Repo } from '../storage/repo';
import { card, folder, image, page } from '../test/fixtures';
import { tabChannel, type Channel } from './channel';
import { createStore, type Store } from './store';

let n = 0;
// stands in for BroadcastChannel: a message reaches every other tab, never the sender
function wire() {
  const tabs: (() => void)[] = [];
  return (): Channel => {
    let mine: (() => void) | undefined;
    return { post: () => tabs.filter((f) => f !== mine).forEach((f) => queueMicrotask(f)), listen: (fn) => { mine = fn; tabs.push(fn); } };
  };
}
async function twoTabs() {
  const db = `tabs-${n++}`; const channel = wire();
  const repos: Repo[] = [];
  const tab = async () => { const s = createStore(async () => { const r = await openRepo(db); repos.push(r); return r; }, channel()); await s.init(); return s; };
  const a = await tab(); await a.flush();
  const b = await tab();
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 15)); await a.flush(); await b.flush(); } };
  const reopened = async () => { const s = createStore(() => openRepo(db)); await s.init(); await s.flush(); return s; };
  await settle();
  return { a, b, tab, settle, reopened, repos, home: a.get().folders[0].id };
}
const pageNow = (s: Store, id = 'p') => s.get().pages.find((p) => p.id === id);

describe('two tabs open', () => {
  it('shows each tab what the other saved', async () => {
    const { a, b, settle, home } = await twoTabs();
    await a.addPage(page('p', home), []); await settle();
    expect(pageNow(b)).toBeDefined();
    b.renameFolder(home, 'Renamed'); await settle();
    expect(a.get().folders[0].name).toBe('Renamed');
  });

  it('keeps a photo added in one tab when the other then edits the page', async () => {
    const { a, b, settle, reopened, home } = await twoTabs();
    await a.addPage(page('p', home), []); await settle();
    b.updatePage('p', (p) => ({ ...p, cards: [card('c', 'm1')] }), [image('m1')]); await settle();
    a.updatePage('p', (p) => ({ ...p, story: 'moved a sticker' })); await settle();
    b.updatePage('p', (p) => ({ ...p, end: '2026-12-01' })); await settle();
    const later = await reopened();
    expect(pageNow(later)).toMatchObject({ story: 'moved a sticker', end: '2026-12-01', cards: [expect.objectContaining({ imageId: 'm1' })] });
    expect(await later.image('m1')).toBeDefined();
  });

  it('does not bring back a folder the other tab deleted', async () => {
    const { a, b, settle, reopened, home } = await twoTabs();
    await a.addPage(page('p', home), []); await settle();
    b.deleteFolder(home); await settle();
    a.renameFolder(home, 'ghost'); a.updatePage('p', (p) => ({ ...p, story: 'ghost' })); await settle();
    const later = await reopened();
    expect(later.get().folders).toEqual([]);
    expect(later.get().pages).toEqual([]);
  });

  it('does not lose an edit made while catching up', async () => {
    const { a, b, settle, home } = await twoTabs();
    await a.addPage(page('p', home), []); await settle();
    b.renameFolder(home, 'from b');
    await Promise.resolve();                                   // a has heard, and is about to reload
    a.updatePage('p', (p) => ({ ...p, story: 'typed in a' }));
    await settle();
    expect(pageNow(a)!.story).toBe('typed in a');
    expect(a.get().folders[0].name).toBe('from b');
  });

  it('never lists a new page twice', async () => {
    const { a, b, settle, home } = await twoTabs();
    b.renameFolder(home, 'busy');
    await a.addPage(page('p', home), [], folder('extra', 5)); await settle();
    expect(a.get().pages.map((p) => p.id)).toEqual(['p']);
    expect(a.get().folders.filter((f) => f.id === 'extra')).toHaveLength(1);
  });

  it('keeps a change that could not be saved when the other tab saves something', async () => {
    const { a, b, settle, home, repos } = await twoTabs();
    await a.addPage(page('p', home), []); await settle();
    vi.spyOn(repos[0], 'putPage').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    a.updatePage('p', (p) => ({ ...p, story: 'only in a' })); await settle();
    b.renameFolder(home, 'from b'); await settle();
    expect(pageNow(a)!.story).toBe('only in a');
    expect(a.get().saveError).not.toBeNull();
  });
});

it('tidies away unused pictures when the app starts', async () => {
  const db = `tabs-${n++}`; const first = await openRepo(db);
  await first.markSeeded();
  await first.putPage(page('p', 'f', [card('a')]), { images: [image('img-a')], folder: folder('f') });
  await first.putPage(page('p', 'f', []));
  const s = createStore(() => openRepo(db)); await s.init(); await s.flush();
  expect(await first.getImage('img-a')).toBeUndefined();
});

it('uses the browser channel to tell other tabs, not itself', async () => {
  const one = tabChannel()!, two = tabChannel()!; const heard: string[] = [];
  one.listen(() => heard.push('one')); two.listen(() => heard.push('two'));
  one.post(); await new Promise((r) => setTimeout(r, 50));
  expect(heard).toEqual(['two']);
  one.close?.(); two.close?.();
});
