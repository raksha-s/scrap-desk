// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createStage } from '../stage/createStage';
import type { Stage } from '../stage/Stage';
import { card, page } from '../test/fixtures';
import { readyStore, renderWith } from '../test/render';

vi.mock('../stage/createStage', () => ({ createStage: vi.fn(() => null) }));
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.mocked(createStage).mockImplementation(() => null); vi.restoreAllMocks(); });

const broken = (id: string, folderId: string) => ({ ...page(id, folderId, [card('x')]), direction: undefined as never });

describe('when something cannot be drawn', () => {
  it('falls back to the list if the 3D desk fails', async () => {
    const boom = () => { throw new Error('stage broke'); };
    vi.mocked(createStage).mockImplementation(() => ({ setFolders: boom, setView() {}, focusTo() {}, refreshLabels() {}, setPointer() {}, setHover() {}, dispose() {} }) as unknown as Stage);
    renderWith(await readyStore(), <App />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Folder view' }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByRole('button', { name: /Unnamed Folder/ })).toBeTruthy();
  });

  it('keeps the rest of a folder when one page is damaged', async () => {
    const store = await readyStore(); const id = store.get().folders[0].id;
    await store.addPage(broken('bad', id), []); await store.addPage(page('good', id, [], 2), []);
    location.hash = `/f/${id}`;
    renderWith(store, <App />);
    await waitFor(() => expect(document.querySelectorAll('#folderView .page-card .sheet')).toHaveLength(1));
    expect(screen.getByRole('heading', { level: 2, name: 'Unnamed Folder' })).toBeTruthy();
  });

  it('shows a message with a way back, not a blank screen', async () => {
    const store = await readyStore(); const id = store.get().folders[0].id;
    await store.addPage(broken('bad', id), []);
    location.hash = '/p/bad';
    renderWith(store, <App />);
    expect((await screen.findByRole('alert')).textContent).toContain("Something here couldn't be shown. Your journals are still saved.");
    fireEvent.click(screen.getByRole('button', { name: 'Back to the desk' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Scrap Desk' })).toBeTruthy());
    expect(location.hash).toBe('#/');
  });
});
