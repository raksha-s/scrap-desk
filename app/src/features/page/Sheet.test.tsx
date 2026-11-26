// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { art } from '../../engine/manifest';
import type { ArtType, Item, Page } from '../../engine/types';
import { StoreContext } from '../../state/useApp';
import { createStore } from '../../state/store';
import { memoryRepo } from '../../storage/memory';
import { card, image, page } from '../../test/fixtures';
import { measureNote, noteFontsReady } from './measureNote';
import { cardCaption, FRAMES, Sheet } from './Sheet';

const box = { x: 450, y: 600, w: 100, h: 50, rot: 5, z: 3, d: 85 };
const LISTS = { stamp: 'stamps', leaf: 'leaves', pattern: 'patterns', sticker: 'stickers', flower: 'flowers', cat: 'cats', paper: 'papers' } as const;

function everything(): Page {
  const c = card('c'), a = { ...card('al', 'img-al', 'album'), album: { title: 'Blue', artist: 'Joni' } };
  const p = page('p', 'f', [c, a]);
  p.direction.palette = { ...p.direction.palette, paperKind: 'grid' };
  const arts = (Object.keys(LISTS) as ArtType[]).map((type, i): Item => ({ ...box, id: `art${i}`, type, art: Object.keys(art[LISTS[type]])[0] }));
  p.items = [
    { ...box, id: 'ph', type: 'photo', cardId: 'c', frame: 'torn', torn: 'polygon(0% 0%)' },
    { ...box, id: 'alb', type: 'photo', cardId: 'al', frame: 'polaroid', torn: 'none' },
    { ...box, id: 'no', type: 'note', text: 'My words', sig: '— Nov 2026', kind: 'kraft', fs: 27, lh: 32, torn: 'polygon(1% 1%)' },
    { ...box, id: 'ti', type: 'title', text: 'November', chip: '1 – 30 Nov 2026', tfs: 90 },
    { ...box, id: 'qu', type: 'quote', text: 'I will cherish it all', qfs: 52 },
    { ...box, id: 'ta', type: 'tape', kind: 'sage' },
    { ...box, id: 'sc', type: 'scrap', text: '✦ diwali', mono: true },
    ...arts,
  ];
  return p;
}
const url = (id: string) => `blob:${id}`;
const $ = (s: string) => document.querySelector(s) as HTMLElement;

describe('Sheet', () => {
  it('draws every kind of piece with the prototype classes', () => {
    render(<Sheet page={everything()} imageUrl={url} />);
    expect($('.sheet').className).toBe('sheet paper-grid');
    expect($('.sheet > .holes')).toBeTruthy();
    expect($('.it.photo.fr-torn.has-clip .ph img').getAttribute('src')).toBe('blob:img-c');
    expect($('.it.photo.album .rec')).toBeTruthy();
    expect($('.it.photo.album img').getAttribute('alt')).toBe('Blue — Joni');
    expect($('.it.photo.album .cap').textContent).toBe('Blue');
    expect($('.it.note.has-clip .pnote.kraft .sig').textContent).toBe('— Nov 2026');
    expect($('.it.title h2').textContent).toBe('November');
    expect($('.it.title .chip').textContent).toBe('1 – 30 Nov 2026');
    expect($('.it.quote q').textContent).toBe('I will cherish it all');
    expect($('.it.quote svg path')).toBeTruthy();
    expect($('.it.tape .tstrip.t-sage')).toBeTruthy();
    expect($('.it.scrap.mono').textContent).toBe('✦ diwali');
    expect(document.querySelectorAll('img.art')).toHaveLength(7);
    expect($('.it.stamp img.art').getAttribute('src')).toMatch(/^art\/stamps\//);
  });

  it('carries the page colours', () => {
    const p = everything(); render(<Sheet page={p} imageUrl={url} />);
    expect($('.sheet').style.getPropertyValue('--accent')).toBe(p.direction.palette.accent);
    expect($('.sheet').style.getPropertyValue('--photo-filter')).toBe(p.direction.palette.filter);
  });

  it('positions by centre', () => {
    render(<Sheet page={everything()} imageUrl={url} />);
    const n = $('[data-id="ta"]');
    expect([n.style.left, n.style.top, n.style.width, n.style.height, n.style.transform]).toEqual(['400px', '575px', '100px', '50px', 'rotate(5deg)']);
    expect([n.style.getPropertyValue('--z'), n.style.getPropertyValue('--d')]).toEqual(['3', '85']);
  });

  it('marks editing, entering, selection, new and developing pieces', () => {
    render(<Sheet page={everything()} imageUrl={url} editing enter selectedId="ti" addedIds={['ta']} freshCardId="c" />);
    expect($('.sheet').className).toBe('sheet paper-grid editing enter');
    expect($('[data-id="ti"]').classList.contains('is-sel')).toBe(true);
    expect($('[data-id="ta"]').classList.contains('pop')).toBe(true);
    expect($('[data-id="ph"]').classList.contains('developing')).toBe(true);
    expect($('[data-id="alb"]').classList.contains('developing')).toBe(false);
  });

  it('skips unknown art, unknown piece types and photos with no card, drawing the rest', () => {
    const p = everything();
    p.items = [
      { ...box, id: 'x1', type: 'stamp', art: 'no-longer-exists' },
      { ...box, id: 'x2', type: 'photo', cardId: 'gone', frame: 'polaroid', torn: 'none' },
      { ...box, id: 'x3', type: 'hologram' } as unknown as Item,
      { ...box, id: 'ok', type: 'tape', kind: 'sage' },
    ];
    render(<Sheet page={p} imageUrl={url} />);
    expect([...document.querySelectorAll('.it')].map((n) => (n as HTMLElement).dataset.id)).toEqual(['ok']);
  });

  it('shows an empty frame when the image is missing', () => {
    render(<Sheet page={everything()} imageUrl={() => undefined} />);
    expect($('[data-id="ph"] .ph')).toBeTruthy();
    expect($('[data-id="ph"] img')).toBeNull();
  });

  describe('from storage', () => {
    afterEach(() => vi.restoreAllMocks());
    it('loads photos through the store when no address is given', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:stored');
      const store = createStore(async () => memoryRepo()); await store.init();
      const p = page('p', store.get().folders[0].id, [card('c', 'img-stored')]);
      await store.addPage(p, [image('img-stored')]);
      render(<StoreContext.Provider value={store}><Sheet page={p} /></StoreContext.Provider>);
      await waitFor(() => expect($('.ph img')?.getAttribute('src')).toBe('blob:stored'));
    });
  });
});

describe('captions', () => {
  const p = page('p', 'f', [card('c')]);
  it('falls back to the date, keeps an emptied caption empty, and shortens album titles', () => {
    expect(cardCaption(card('c'), p)).toBe(p.direction.dateShort);
    expect(cardCaption({ ...card('c'), caption: '' }, p)).toBe('');
    expect(cardCaption({ ...card('a', 'i', 'album'), album: { title: 'T'.repeat(40), artist: '' } }, p)).toHaveLength(26);
  });
  it('offers the six frames', () => {
    expect(FRAMES.map((f) => f[0])).toEqual(['polaroid', 'instax', 'film', 'kraft', 'round', 'torn']);
  });
});

describe('measuring a note', () => {
  it('measures with the real note styles and leaves nothing behind', () => {
    let seen = '';
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) { seen = `${this.className}|${this.style.width}|${this.style.getPropertyValue('--fs')}|${this.textContent}`; return 312; });
    expect(measureNote('Words', '— sig', 400, 30, 35)).toBe(312);
    expect(seen).toBe('pnote|400px|30px|Words— sig');
    expect(document.querySelector('.pnote')).toBeNull();
  });
  it('does not wait forever for fonts', async () => {
    await expect(noteFontsReady()).resolves.toBeUndefined();
  });
});
