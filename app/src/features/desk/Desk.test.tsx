// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { readyStore, renderWith } from '../../test/render';
import { page } from '../../test/fixtures';

// jsdom has no WebGL, which is exactly the fallback case
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); HTMLCanvasElement.prototype.getContext = () => null; });
afterEach(() => vi.restoreAllMocks());

describe('the desk', () => {
  it('falls back to list view without WebGL', async () => {
    const store = await readyStore();
    const id = store.get().folders[0].id;
    await store.addPage(page('p', id), []);
    renderWith(store, <App />);
    const folders = screen.getByRole('button', { name: 'Folder view' }) as HTMLButtonElement;
    await waitFor(() => expect(folders.disabled).toBe(true));
    expect(folders.title).toBe("3D view isn't available on this device");
    expect(screen.getByRole('button', { name: 'List view' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Unnamed Folder 1 page/ })).toBeTruthy();
  });

  it('opens a folder from the list', async () => {
    const store = await readyStore();
    renderWith(store, <App />);
    fireEvent.click(await screen.findByRole('button', { name: /Unnamed Folder empty/ }));
    await waitFor(() => expect(location.hash).toBe(`#/f/${store.get().folders[0].id}`));
    await waitFor(() => expect(document.body.dataset.view).toBe('folder'));
    expect(document.querySelector('#home')!.hasAttribute('inert')).toBe(true);
  });

  it('shows an empty desk with + Add New when there are no folders', async () => {
    const store = await readyStore();
    act(() => store.deleteFolder(store.get().folders[0].id));
    renderWith(store, <App />);
    expect(screen.getByRole('button', { name: '+ Add New' })).toBeTruthy();
    expect(document.querySelectorAll('.folder-row')).toHaveLength(0);
  });

  it('shows the save message while saving is broken', async () => {
    const { createStore, SAVE_ERROR } = await import('../../state/store');
    const store = createStore(async () => { throw new Error('blocked'); });
    renderWith(store, <App />);
    expect((await screen.findByRole('alert')).textContent).toBe(SAVE_ERROR);
  });
});
