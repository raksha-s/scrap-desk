// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { folder, image } from '../../test/fixtures';
import { Toaster } from '../../ui/toast';
import { emptyDraft } from './form';
import { WritingPad } from './WritingPad';

const importer = async (files: File[]) => ({
  images: files.filter((f) => !f.name.endsWith('.heic')).map((f) => image(f.name)),
  failed: files.filter((f) => f.name.endsWith('.heic')).map((f) => f.name),
});
function open(initial = emptyDraft()) {
  const onGenerate = vi.fn(), onClose = vi.fn();
  render(<><WritingPad open initial={initial} folders={[{ ...folder('f1'), name: 'Trips' }]} importer={importer} onGenerate={onGenerate} onClose={onClose} /><Toaster /></>);
  return { onGenerate, onClose };
}
const leaf = () => document.querySelector('.leaf:not([inert])') as HTMLElement;
const q = (s: string) => leaf().querySelector(s) as HTMLElement;
const next = () => fireEvent.click(q('[data-next]'));
const files = (...names: string[]) => names.map((n) => new File([n], n, { type: n.endsWith('.heic') ? '' : 'image/jpeg' }));
const pick = (...names: string[]) => fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: files(...names) } });

describe('writing pad', () => {
  it('walks the four sheets and hands over the answers', async () => {
    const { onGenerate } = open();
    expect(leaf().getAttribute('aria-label')).toBe('Step 1 of 4');
    expect((q('[data-next]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Trips' })); next();
    expect(screen.getByRole('heading', { name: 'When was it?' })).toBeTruthy();
    expect((q('[data-next]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-09' } }); next();
    fireEvent.change(screen.getByRole('textbox', { name: 'What happened?' }), { target: { value: 'Khichdi.' } });
    expect(document.querySelector('#storyCount')!.textContent).toBe('8'); next();
    expect(document.querySelectorAll('#slots li')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /Add a photo, slot/ })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f1', start: '2026-11-09', story: 'Khichdi.' }));
  });

  it('turns the page on Enter in a one-line field', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'New folder' }));
    const name = screen.getByLabelText('Folder name') as HTMLInputElement;
    expect(name.value).toBe('Unnamed Folder'); expect(name.maxLength).toBe(28);
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(leaf().getAttribute('aria-label')).toBe('Step 2 of 4');
  });

  it('limits the story to 900 characters and has no sample link', () => {
    open();
    expect((document.querySelector('textarea') as HTMLTextAreaElement).maxLength).toBe(900);
    expect(screen.queryByText('Load my sample')).toBeNull();
  });

  it('caps photos at six and says so', async () => {
    open(emptyDraft('f1'));
    pick('1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg');
    await waitFor(() => expect(document.querySelectorAll('.slot-full')).toHaveLength(6));
    expect(screen.getByRole('status').textContent).toBe('Up to 6 photos per page — added the first 6.');
    fireEvent.click(document.querySelector('[aria-label="Remove photo 2"]')!);
    expect(document.querySelectorAll('.slot-full')).toHaveLength(5);
  });

  it('names the photos it cannot read and adds the others', async () => {
    open(emptyDraft('f1'));
    pick('a.jpg', 'b.heic', 'c.jpg');
    await waitFor(() => expect(document.querySelectorAll('.slot-full')).toHaveLength(2));
    expect(screen.getByRole('status').textContent).toBe("Couldn't read b.heic.");
  });

  it('closes without generating', () => {
    const { onClose, onGenerate } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled(); expect(onGenerate).not.toHaveBeenCalled();
  });

  it('reopens on the last sheet when coming back with finished answers', () => {
    open({ ...emptyDraft('f1'), start: '2026-11-09', touched: true });
    expect(leaf().getAttribute('aria-label')).toBe('Step 4 of 4');
  });
});
