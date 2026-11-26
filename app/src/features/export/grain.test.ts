// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { flattenGrain } from './grain';

// the paper grain is an SVG noise filter, which comes out solid black inside an exported image
it('swaps the SVG grain for a bitmap of itself', async () => {
  const host = document.createElement('div');
  const drawn: string[] = [];
  await flattenGrain(host, {
    read: (name) => (name === '--grain' ? 'url("data:image/svg+xml;utf8,<svg/>")' : ''),
    rasterise: async (src) => { drawn.push(src); return 'data:image/png;base64,AAA'; },
  });
  expect(drawn).toEqual(['data:image/svg+xml;utf8,<svg/>']);
  expect(host.style.getPropertyValue('--grain')).toBe('url("data:image/png;base64,AAA")');
  expect(host.style.getPropertyValue('--grain-soft')).toBe('');
});

it('keeps the export going if the grain cannot be drawn', async () => {
  const host = document.createElement('div');
  await expect(flattenGrain(host, { read: () => 'url("data:image/svg+xml;utf8,<svg/>")', rasterise: vi.fn(async () => { throw new Error('no'); }) })).resolves.toBeUndefined();
  expect(host.style.getPropertyValue('--grain')).toBe('');
});

it('does not wait forever for the grain', async () => {
  vi.useFakeTimers(); let done = false;
  const waiting = flattenGrain(document.createElement('div'), { read: () => 'url("data:image/svg+xml;utf8,<svg/>")', rasterise: () => new Promise<string>(() => {}) }).then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(2999); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(3001 + 3000); await waiting; expect(done).toBe(true);
  vi.useRealTimers();
});

it('carries on when the browser refuses to read the drawn grain back', async () => {
  vi.stubGlobal('Image', class { onload?: () => void; set src(_v: string) { queueMicrotask(() => this.onload?.()); } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as unknown as null);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => { throw new DOMException('tainted', 'SecurityError'); });
  document.documentElement.style.setProperty('--grain', 'url("data:image/svg+xml;utf8,<svg/>")');
  const host = document.createElement('div');
  await expect(flattenGrain(host)).resolves.toBeUndefined();
  expect(host.style.getPropertyValue('--grain')).toBe('');
  vi.unstubAllGlobals(); vi.restoreAllMocks();
}, 2000);
