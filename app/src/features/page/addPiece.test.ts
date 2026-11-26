import { describe, expect, it } from 'vitest';
import { art } from '../../engine/manifest';
import { card, image, page } from '../../test/fixtures';
import { readyStore } from '../../test/render';
import { addCard, addSticker, imagesFull } from './addPiece';

const pageWith = (kinds: Partial<Record<'photo' | 'camera' | 'album', number>>) =>
  page('p', 'f', Object.entries(kinds).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => card(`${k}${i}`, `m-${k}${i}`, k as 'photo'))));

async function stored(p = pageWith({ photo: 1 })) {
  const store = await readyStore(); const f = store.get().folders[0].id;
  await store.addPage({ ...p, folderId: f }, []);
  return store;
}

describe('six images to a page', () => {
  it('counts photos and camera shots, not album covers', () => {
    expect(imagesFull(pageWith({ photo: 5, album: 3 }))).toBe(false);
    expect(imagesFull(pageWith({ photo: 4, camera: 2 }))).toBe(true);
  });
});

describe('adding a piece', () => {
  it('adds a camera shot with tape and stores its picture', async () => {
    const store = await stored();
    const ids = addCard(store, 'p', 'camera', image('shot'))!;
    const p = store.get().pages[0];
    expect(p.cards.at(-1)).toMatchObject({ kind: 'camera', imageId: 'shot', w: 40, h: 30 });
    expect(p.items.slice(-2).map((i) => i.id)).toEqual(ids);
    expect(p.items.at(-1)!.type).toBe('tape');
    await store.flush(); expect(await store.image('shot')).toBeDefined();
  });
  it('adds an album cover as a square card with its title', async () => {
    const store = await stored(pageWith({ photo: 6 }));
    expect(addCard(store, 'p', 'album', image('cover'), { title: 'Blue', artist: 'Joni' })).toHaveLength(2);
    expect(store.get().pages[0].cards.at(-1)).toMatchObject({ kind: 'album', w: 500, h: 500, album: { title: 'Blue', artist: 'Joni' } });
  });
  it('refuses a seventh image', async () => {
    const store = await stored(pageWith({ photo: 6 }));
    expect(addCard(store, 'p', 'camera', image('shot'))).toBeNull();
    expect(store.get().pages[0].cards).toHaveLength(6);
  });
  it('drops the piece if that page is gone', async () => {
    const store = await stored(); store.deletePage('p');
    expect(addCard(store, 'p', 'camera', image('shot'))).toBeNull();
    expect(addSticker(store, 'p', 'cat', Object.keys(art.cats)[0])).toBeNull();
    expect(store.get().pages).toEqual([]);
  });
  it('adds a sticker on top', async () => {
    const store = await stored();
    const id = addSticker(store, 'p', 'cat', Object.keys(art.cats)[0])!;
    expect(store.get().pages[0].items.at(-1)).toMatchObject({ id, type: 'cat', picked: true });
  });
});
