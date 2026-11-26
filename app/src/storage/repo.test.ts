import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { card, folder, image, page } from '../test/fixtures';
import { memoryRepo } from './memory';
import { openRepo, type Repo } from './repo';

let n = 0;
const name = () => `repo-test-${n++}`;

describe.each([
  ['browser storage', () => openRepo(name())],
  ['memory', async () => memoryRepo()],
] as [string, () => Promise<Repo>][])('%s', (_label, open) => {
  it('starts empty and unseeded, then remembers being seeded', async () => {
    const r = await open();
    expect(await r.load()).toEqual({ folders: [], pages: [], seeded: false });
    await r.markSeeded();
    expect((await r.load()).seeded).toBe(true);
  });

  it('lists folders and pages in the order they were created', async () => {
    const r = await open();
    await r.putFolder(folder('b', 2)); await r.putFolder(folder('a', 3)); await r.putFolder(folder('c', 1));
    await r.putPage(page('p2', 'a', [], 5)); await r.putPage(page('p1', 'a', [], 4));
    const data = await r.load();
    expect(data.folders.map((f) => f.id)).toEqual(['c', 'b', 'a']);
    expect(data.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('saves a page with its images and a new folder together', async () => {
    const r = await open();
    await r.putPage(page('p', 'f', [card('c')]), { images: [image('img-c', 'bytes')], folder: folder('f') });
    expect((await r.load()).folders.map((f) => f.id)).toEqual(['f']);
    const got = await r.getImage('img-c');
    expect(got).toMatchObject({ id: 'img-c', width: 40, height: 30 });
    expect(got!.blob.type).toBe('image/jpeg');
    expect(await got!.blob.text()).toBe('bytes');
  });

  it('drops images a page no longer uses', async () => {
    const r = await open();
    await r.putPage(page('p', 'f', [card('a'), card('b')]), { images: [image('img-a'), image('img-b')], folder: folder('f') });
    await r.putPage(page('p', 'f', [card('b')]));
    expect(await r.getImage('img-a')).toBeUndefined();
    expect(await r.getImage('img-b')).toBeDefined();
  });

  it('deleting a page removes its images only', async () => {
    const r = await open();
    await r.putPage(page('p', 'f', [card('a')]), { images: [image('img-a')], folder: folder('f') });
    await r.putPage(page('q', 'f', [card('b')]), { images: [image('img-b')] });
    await r.deletePage('p');
    expect((await r.load()).pages.map((p) => p.id)).toEqual(['q']);
    expect(await r.getImage('img-a')).toBeUndefined();
    expect(await r.getImage('img-b')).toBeDefined();
  });

  it('deleting a folder removes its pages and images', async () => {
    const r = await open();
    await r.putPage(page('p', 'f', [card('a')]), { images: [image('img-a')], folder: folder('f') });
    await r.putPage(page('q', 'g', [card('b')]), { images: [image('img-b')], folder: folder('g', 2) });
    await r.deleteFolder('f');
    const data = await r.load();
    expect(data.folders.map((f) => f.id)).toEqual(['g']);
    expect(data.pages.map((p) => p.id)).toEqual(['q']);
    expect(await r.getImage('img-a')).toBeUndefined();
    expect(await r.getImage('img-b')).toBeDefined();
  });

  it('ignores pages whose folder is missing', async () => {
    const r = await open();
    await r.putFolder(folder('f'));
    await r.putPage(page('kept', 'f')); await r.putPage(page('orphan', 'gone'));
    expect((await r.load()).pages.map((p) => p.id)).toEqual(['kept']);
  });
});

it('keeps everything across a reopen', async () => {
  const db = name(); const p = page('p', 'f', [card('c')]);
  const first = await openRepo(db);
  await first.markSeeded();
  await first.putPage(p, { images: [image('img-c', 'kept bytes')], folder: folder('f') });
  const second = await openRepo(db);
  expect(await second.load()).toEqual({ folders: [folder('f')], pages: [p], seeded: true });
  expect(await (await second.getImage('img-c'))!.blob.text()).toBe('kept bytes');
});
