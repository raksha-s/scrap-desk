// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApp } from '../../state/useApp';
import { page } from '../../test/fixtures';
import { readyStore, renderWith } from '../../test/render';
import { FolderView } from './FolderView';

async function setup(pages = 0) {
  const store = await readyStore();
  const f = store.addFolder('Trips');
  for (let i = 0; i < pages; i++) await store.addPage(page(`p${i}`, f.id, [], i), []);
  const onAddNew = vi.fn();
  function Harness() { const has = useApp((s) => s.folders.some((x) => x.id === f.id)); return <FolderView active folderId={has ? f.id : null} onAddNew={onAddNew} />; }
  location.hash = `/f/${f.id}`;
  renderWith(store, <Harness />);
  const name = () => store.get().folders.find((x) => x.id === f.id)?.name;
  return { store, f, name, onAddNew };
}
const click = (name: string | RegExp, role = 'button') => fireEvent.click(screen.getByRole(role, { name }));
const openMenu = () => click('Folder options');
const startRename = () => { openMenu(); click('Edit name', 'menuitem'); return screen.getByRole('textbox', { name: 'Folder name' }) as HTMLInputElement; };

describe('folder name', () => {
  it('renames on Enter', async () => {
    const { name } = await setup(); const input = startRename();
    expect(input.value).toBe('Trips'); expect(input.maxLength).toBe(28);
    fireEvent.change(input, { target: { value: 'Mountains' } }); fireEvent.keyDown(input, { key: 'Enter' });
    expect(name()).toBe('Mountains');
    expect(screen.getByRole('heading', { level: 2, name: 'Mountains' })).toBeTruthy();
  });
  it('renames when you click away', async () => {
    const { name } = await setup(); const input = startRename();
    fireEvent.change(input, { target: { value: 'Away' } }); fireEvent.blur(input);
    expect(name()).toBe('Away');
  });
  it('cancels on Escape without leaving the folder', async () => {
    const { name, f } = await setup(); const input = startRename();
    fireEvent.change(input, { target: { value: 'Nope' } }); fireEvent.keyDown(input, { key: 'Escape' }); fireEvent.blur(input);
    expect(name()).toBe('Trips');
    expect(location.hash).toBe(`#/f/${f.id}`);
  });
});

describe('folder colour', () => {
  it('recolours and keeps the swatches open', async () => {
    const { store, f } = await setup(); openMenu(); click('Change color', 'menuitem');
    const group = screen.getByRole('radiogroup', { name: 'Folder color' });
    expect(within(group).getAllByRole('radio')).toHaveLength(11);
    fireEvent.click(within(group).getByRole('radio', { name: 'Charcoal' }));
    expect(store.get().folders.find((x) => x.id === f.id)!.skin).toBe('f10');
    expect(within(group).getByRole('radio', { name: 'Charcoal' }).getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('#folderView')!.classList.contains('on-dark')).toBe(true);
    expect(screen.queryByRole('radiogroup', { name: 'Folder color' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('radiogroup', { name: 'Folder color' })).toBeNull();
  });
});

describe('inside a folder', () => {
  it('says so when empty, and offers to start a page', async () => {
    const { onAddNew, f } = await setup();
    expect(screen.getByText('empty folder')).toBeTruthy();
    expect(screen.getByText('Nothing in here yet — your first page will land in this folder.')).toBeTruthy();
    click(/Start a page here/); expect(onAddNew).toHaveBeenLastCalledWith(f.id);
    click('Add New'); expect(onAddNew).toHaveBeenCalledTimes(2);
  });
  it('shows the count and a thumbnail per page, which opens it', async () => {
    await setup(2);
    expect(screen.getByText('2 pages')).toBeTruthy();
    expect(document.querySelectorAll('.page-card .thumb .sheet')).toHaveLength(2);
    expect(screen.queryByText(/Nothing in here yet/)).toBeNull();
    fireEvent.click(document.querySelectorAll('.page-card')[1]);
    expect(location.hash).toBe('#/p/p1');
  });
  it('goes back with the arrow, and Escape closes a menu before leaving', async () => {
    const { f } = await setup(); openMenu();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull(); expect(location.hash).toBe(`#/f/${f.id}`);
    fireEvent.keyDown(window, { key: 'Escape' }); expect(location.hash).toBe('#/');
    location.hash = `/f/${f.id}`; click('Back to folders'); expect(location.hash).toBe('#/');
  });
});

describe('deleting a folder', () => {
  const ask = () => { openMenu(); click('Delete folder', 'menuitem'); };
  it('asks first, saying what will go; Cancel keeps everything', async () => {
    const { name } = await setup(2); ask();
    expect(screen.getByRole('heading', { name: 'Delete “Trips”?' })).toBeTruthy();
    expect(screen.getByText('This permanently deletes the folder and its 2 pages.')).toBeTruthy();
    click('Cancel'); expect(name()).toBe('Trips');
    expect(screen.queryByRole('heading', { name: 'Delete “Trips”?' })).toBeNull();
  });
  it('deletes and returns to the desk', async () => {
    const { store, name } = await setup(1); ask();
    expect(screen.getByText('This permanently deletes the folder and its 1 page.')).toBeTruthy();
    act(() => click('Delete'));
    expect(name()).toBeUndefined(); expect(store.get().pages).toEqual([]); expect(location.hash).toBe('#/');
  });
  it('does not count pages an empty folder hasn’t got', async () => {
    await setup(0); ask();
    expect(screen.getByText('This permanently deletes the folder.')).toBeTruthy();
  });
});
