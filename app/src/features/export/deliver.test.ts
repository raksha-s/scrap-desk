import { describe, expect, it, vi } from 'vitest';
import { deliver, exportFilename } from './deliver';

const blob = new Blob(['png'], { type: 'image/png' });
const name = 'scrap-desk-2026-11-01.png';
const sharing = (share: (d: ShareData) => Promise<void> = vi.fn(async () => {})) => ({ canShare: () => true, share }) as unknown as Navigator;
const rejects = (error: string) => sharing(vi.fn(async () => { throw new DOMException('no', error); }));

describe('export delivery', () => {
  it('names the file after the start date', () => {
    expect(exportFilename('2026-11-01')).toBe(name);
  });

  it('shares on a touch device that can share files', async () => {
    const download = vi.fn(); const share = vi.fn(async (_d: ShareData) => {});
    await expect(deliver(blob, name, { nav: sharing(share), download, touch: true })).resolves.toBe('shared');
    expect(share.mock.calls[0][0].files![0].name).toBe(name);
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads when the share sheet is refused because the tap has expired', async () => {
    const download = vi.fn();
    await expect(deliver(blob, name, { nav: rejects('NotAllowedError'), download, touch: true })).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledWith(blob, name);
  });

  it('does nothing more when the person cancels sharing', async () => {
    const download = vi.fn();
    await expect(deliver(blob, name, { nav: rejects('AbortError'), download, touch: true })).resolves.toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads on a computer, and where files cannot be shared', async () => {
    const download = vi.fn();
    await expect(deliver(blob, name, { nav: sharing(), download, touch: false })).resolves.toBe('downloaded');
    await expect(deliver(blob, name, { nav: {} as Navigator, download, touch: true })).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(2);
  });
});
