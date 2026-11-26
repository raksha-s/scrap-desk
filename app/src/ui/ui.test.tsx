// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';
import { FolderArt } from './FolderArt';
import { plural } from './plural';
import { toast, Toaster } from './toast';

afterEach(() => vi.useRealTimers());

describe('toast', () => {
  it('shows a message for 2.8 seconds', () => {
    vi.useFakeTimers(); render(<Toaster />);
    act(() => toast('Saved'));
    expect(screen.getByRole('status').textContent).toBe('Saved');
    act(() => { vi.advanceTimersByTime(2799); }); expect(screen.queryByRole('status')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); }); expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Dialog', () => {
  const setup = () => { const onClose = vi.fn(); render(<Dialog open onClose={onClose} className="dlg"><p>Inside</p></Dialog>); return { onClose, dialog: document.querySelector('dialog')! }; };

  it('closes on a backdrop click only once it has been open a moment', () => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'Date'] });
    const { onClose, dialog } = setup();
    fireEvent.pointerDown(dialog); fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    fireEvent.pointerDown(screen.getByText('Inside')); fireEvent.click(dialog);   // a drag that ends outside is not a click on the backdrop
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog); fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing inside while closed', () => {
    render(<Dialog open={false} onClose={() => {}} className="dlg"><p>Hidden</p></Dialog>);
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

it('asks to confirm with Cancel and Delete', () => {
  const onConfirm = vi.fn(), onCancel = vi.fn();
  render(<ConfirmDialog open title="Delete this page?" body="Gone for good." onConfirm={onConfirm} onCancel={onCancel} />);
  expect(screen.getByRole('heading', { name: 'Delete this page?' })).toBeTruthy();
  expect(screen.getByText('Gone for good.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onCancel).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); expect(onConfirm).toHaveBeenCalledTimes(1);
});

it('draws a folder in its colour', () => {
  render(<FolderArt skin="f03" />);
  expect(document.querySelector('.folder-art img')!.getAttribute('src')).toBe('art/folders/f03.webp');
});

it('counts in words', () => {
  expect(plural(1, 'page')).toBe('1 page');
  expect(plural(2, 'page')).toBe('2 pages');
});
