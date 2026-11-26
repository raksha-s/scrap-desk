import { expect, it, vi } from 'vitest';
import { within } from './within';

it('passes a result through, and gives up on work that never ends', async () => {
  await expect(within(Promise.resolve(7), 100)).resolves.toBe(7);
  await expect(within(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
  vi.useFakeTimers();
  const stuck = expect(within(new Promise(() => {}), 60_000)).rejects.toThrow('took too long');
  await vi.advanceTimersByTimeAsync(60_000); await stuck;
  vi.useRealTimers();
});
