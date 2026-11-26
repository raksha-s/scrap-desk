// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../state/useApp';
import { card, image, page } from '../../test/fixtures';
import { readyStore, renderWith } from '../../test/render';
import { Toaster } from '../../ui/toast';
import { PageView } from './PageView';

// jsdom has no layout: pretend the sheet is drawn at half size
beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 200, right: 450, bottom: 800, width: 450, height: 600, toJSON() {} } as DOMRect); });

async function setup(exporter?: Parameters<typeof PageView>[0]['exporter']) {
  const store = await readyStore();
  const f = store.get().folders[0];
  await store.addPage(page('p', f.id, [card('a'), card('b')]), [image('img-a'), image('img-b')]);
  location.hash = '/p/p';
  function Harness() { const has = useApp((s) => s.pages.some((x) => x.id === 'p')); return <PageView active pageId={has ? 'p' : null} exporter={exporter} />; }
  renderWith(store, <><Harness /><Toaster /></>);
  const saved = () => store.get().pages[0];
  const piece = (id = 'it-a') => saved().items.find((i) => i.id === id)!;
  const node = (id = 'it-a') => document.querySelector(`.it[data-id="${id}"]`) as HTMLElement;
  return { store, f, saved, piece, node };
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const select = (n: HTMLElement) => { fireEvent.pointerDown(n, { button: 0, clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerUp(n, { pointerId: 1 }); };

describe('the journal page', () => {
  it('shows its date, and a back arrow to the folder', async () => {
    const { f, saved } = await setup();
    expect(document.querySelector('#pvMeta')!.textContent).toBe(saved().direction.dateChip);
    click(`Back to ${f.name}`); expect(location.hash).toBe(`#/f/${f.id}`);
  });

  it('drags a piece and saves once, on release', async () => {
    const { store, piece, node } = await setup(); const before = { ...piece() };
    const writes = vi.spyOn(store, 'updatePage');
    fireEvent.pointerDown(node(), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(node(), { clientX: 130, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(node(), { clientX: 150, clientY: 140, pointerId: 1 });
    expect(writes).not.toHaveBeenCalled();
    expect(node().style.left).toBe(`${before.x + 100 - before.w / 2}px`);
    fireEvent.pointerUp(node(), { pointerId: 1 });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(piece()).toMatchObject({ x: before.x + 100, y: before.y + 80 });
  });

  it('offers piece controls on selection, and applies them', async () => {
    const { piece, node, saved } = await setup(); const before = { ...piece() };
    expect(screen.queryByRole('button', { name: 'Rotate right' })).toBeNull();
    select(node());
    expect(node().classList.contains('is-sel')).toBe(true);
    click('Rotate right'); expect(piece().rot).toBe(before.rot + 6);
    click('Film strip frame'); expect(piece()).toMatchObject({ frame: 'film' });
    click('Delete'); expect(saved().cards.map((c) => c.id)).toEqual(['b']);
    expect(screen.queryByRole('button', { name: 'Rotate right' })).toBeNull();
  });

  it('offers frames on hover, without piece controls', async () => {
    const { node } = await setup();
    fireEvent.pointerOver(node(), { pointerType: 'mouse' });
    expect(screen.getByRole('button', { name: 'Kraft mat frame' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('saves captions as they are typed; Enter finishes', async () => {
    const { saved, node } = await setup();
    const cap = node().querySelector('.cap') as HTMLElement;
    cap.focus(); cap.textContent = 'Us'; fireEvent.input(cap);
    expect(saved().cards[0].caption).toBe('Us');
    cap.textContent = ''; fireEvent.input(cap);
    expect(saved().cards[0].caption).toBe('');
    cap.focus(); fireEvent.keyDown(cap, { key: 'Enter' });
    expect(document.activeElement).not.toBe(cap);
  });

  it('opens fitted at 100% and zooms in steps', async () => {
    await setup(); const fit = () => screen.getByTitle('Fit the page to the screen').textContent;
    expect(fit()).toBe('100%');
    click('Zoom in'); expect(fit()).toBe('125%');
    expect(document.querySelector('#pageView')!.classList.contains('zoomed')).toBe(true);
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom level' }), { target: { value: '300' } });
    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTitle('Fit the page to the screen')); expect(fit()).toBe('100%');
  });

  it('asks before deleting the page, then returns to its folder', async () => {
    const { store, f } = await setup(); click('Delete page');
    expect(screen.getByRole('heading', { name: 'Delete this page?' })).toBeTruthy();
    expect(screen.getByText('This permanently deletes the page and its photos.')).toBeTruthy();
    click('Cancel'); expect(store.get().pages).toHaveLength(1);
    click('Delete page'); act(() => click('Delete'));
    expect(store.get().pages).toEqual([]); expect(location.hash).toBe(`#/f/${f.id}`);
  });
});

describe('export', () => {
  const button = () => screen.getByRole('button', { name: /Export/ }) as HTMLButtonElement;

  it('draws the page, hands it over, and is off while working', async () => {
    let finish!: (b: Blob) => void;
    const exportPage = vi.fn(() => new Promise<Blob>((res) => { finish = res; }));
    const deliver = vi.fn(async () => 'downloaded' as const);
    await setup({ exportPage, deliver });
    fireEvent.click(button());
    expect(button().disabled).toBe(true);
    expect(exportPage).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' }), expect.any(Function));
    const png = new Blob(['x']); await act(async () => finish(png));
    expect(deliver).toHaveBeenCalledWith(png, 'scrap-desk-2026-11-01.png');
    await waitFor(() => expect(button().disabled).toBe(false));
  });

  it('says so when it fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await setup({ exportPage: async () => { throw new Error('boom'); }, deliver: vi.fn() });
    fireEvent.click(button());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe("Couldn't export this page. Try again."));
    expect(button().disabled).toBe(false);
  });
});
