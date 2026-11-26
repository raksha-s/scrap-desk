// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { whenImagesLoaded } from './loaded';

const img = (complete: boolean) => { const i = document.createElement('img'); Object.defineProperty(i, 'complete', { value: complete }); return i; };
const holder = (...imgs: HTMLImageElement[]) => { const d = document.createElement('div'); d.append(...imgs); return d; };
afterEach(() => vi.useRealTimers());

it('is ready at once when every image already is', async () => {
  await expect(whenImagesLoaded(holder(img(true), img(true)))).resolves.toBeUndefined();
});

it('waits for the rest to load or fail', async () => {
  const a = img(false), b = img(false); let done = false;
  const waiting = whenImagesLoaded(holder(a, b)).then(() => { done = true; });
  a.dispatchEvent(new Event('load')); await Promise.resolve();
  expect(done).toBe(false);
  b.dispatchEvent(new Event('error')); await waiting;
  expect(done).toBe(true);
});

it('gives up after five seconds rather than hang the export', async () => {
  vi.useFakeTimers(); let done = false;
  const waiting = whenImagesLoaded(holder(img(false))).then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(4999); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await waiting; expect(done).toBe(true);
});
