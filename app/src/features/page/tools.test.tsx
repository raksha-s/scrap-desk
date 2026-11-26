// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StoredImage } from '../../storage/repo';
import { useApp } from '../../state/useApp';
import { card, image, page } from '../../test/fixtures';
import { readyStore, renderWith } from '../../test/render';
import { Toaster } from '../../ui/toast';
import { searchAlbums } from '../album/search';
import { PageView } from './PageView';

const hit = { key: 'k', title: 'Blue', artist: 'Joni', thumb: 'https://x/t.jpg', cover: 'https://x/c.jpg' };
const search: typeof searchAlbums = async () => ({ list: [hit], status: 'ok' });

async function setup(fetchCover: () => Promise<StoredImage>, photos = 1) {
  const store = await readyStore(); const f = store.get().folders[0];
  await store.addPage(page('p', f.id, Array.from({ length: photos }, (_, i) => card(`c${i}`))), []);
  await store.addPage(page('q', f.id, [], 2), []);
  let show!: (id: string) => void;
  const services = { searchAlbums: search, fetchCover, importImage: async () => image('shot') };
  function Harness() {
    const [id, setId] = useState('p'); show = setId;
    useApp((s) => s.pages);
    return <PageView active pageId={id} services={services} />;
  }
  renderWith(store, <><Harness /><Toaster /></>);
  const pageOf = (id: string) => store.get().pages.find((p) => p.id === id);
  return { store, pageOf, show: (id: string) => act(() => show(id)) };
}

async function pickCover() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Music Cover' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'blue' } });
  fireEvent.submit(screen.getByRole('search'));
  fireEvent.click(await screen.findByRole('button', { name: /Blue/ }));
}

describe('music covers', () => {
  it('puts the cursor in the search box', async () => {
    await setup(async () => image('cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Music Cover' }));
    screen.getByRole('button', { name: 'Close' }).focus();                  // where the browser leaves it on opening
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox')));
  });

  it('adds the downloaded cover and says so', async () => {
    const { pageOf } = await setup(async () => image('cover'));
    await pickCover();
    await waitFor(() => expect(pageOf('p')!.cards.at(-1)).toMatchObject({ kind: 'album', imageId: 'cover' }));
    expect(screen.getByRole('status').textContent).toBe('Added “Blue”. Drag it, tap the caption to rename.');
  });

  it('changes nothing when the cover cannot be downloaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pageOf } = await setup(async () => { throw new Error('404'); });
    await pickCover();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe("Couldn't download that cover. Try another."));
    expect(pageOf('p')!.cards).toHaveLength(1);
  });

  it('adds to the page it started on, even after leaving it', async () => {
    let finish!: (i: StoredImage) => void;
    const { pageOf, show } = await setup(() => new Promise((res) => { finish = res; }));
    await pickCover(); show('q');
    await act(async () => finish(image('cover')));
    expect(pageOf('p')!.cards).toHaveLength(2);
    expect(pageOf('q')!.cards).toHaveLength(0);
  });

  it('copes when that page was deleted meanwhile', async () => {
    let finish!: (i: StoredImage) => void;
    const { store, show } = await setup(() => new Promise((res) => { finish = res; }));
    await pickCover(); show('q'); act(() => store.deletePage('p'));
    await act(async () => finish(image('cover')));
    expect(store.get().pages.map((p) => p.id)).toEqual(['q']);
  });
});

describe('the bottom bar', () => {
  it('switches Add Image off at six, and says why', async () => {
    await setup(async () => image('x'), 6);
    const add = screen.getByRole('button', { name: 'Limit of 6 images reached' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(add);
    expect(screen.getByRole('status').textContent).toBe('This page already has 6 images. Delete one to add another.');
    expect(screen.queryByRole('heading', { name: 'Take a polaroid' })).toBeNull();
  });

  it('adds a picture chosen from files through the camera, developing', async () => {
    const { pageOf } = await setup(async () => image('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Image' }));
    expect(screen.getByRole('heading', { name: 'Take a polaroid' })).toBeTruthy();
    fireEvent.change(document.querySelector('#camFile')!, { target: { files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(pageOf('p')!.cards.at(-1)).toMatchObject({ kind: 'camera', imageId: 'shot' }));
    expect(document.querySelector('#pageView .it.photo.developing')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Developing… give it a few seconds.');
  });

  it('adds a sticker, selects it, and reopens on the same tab', async () => {
    const { pageOf } = await setup(async () => image('x'));
    const before = pageOf('p')!.items.length;
    fireEvent.click(screen.getByRole('button', { name: 'Add Sticker' }));
    for (const tab of ['Cats', 'Flowers', 'Wax seals', 'Clips & pins', 'Leaves', 'Paper', 'Patterns']) expect(screen.getByRole('button', { name: tab })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leaves' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mint' }));
    expect(pageOf('p')!.items).toHaveLength(before + 1);
    expect(pageOf('p')!.items.at(-1)).toMatchObject({ type: 'leaf', art: 'mint' });
    await waitFor(() => expect(document.querySelector('#pageView .it.leaf.is-sel')).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sticker' }));
    expect(screen.getByRole('button', { name: 'Leaves' }).getAttribute('aria-pressed')).toBe('true');
  });
});
