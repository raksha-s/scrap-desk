// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { image } from '../test/fixtures';
import { useImageUrl } from './urls';

let n = 0;
beforeAll(() => { URL.createObjectURL = vi.fn(() => `blob:${++n}`); });

it('loads a stored image once and reuses its address', async () => {
  const load = vi.fn(async (id: string) => image(id));
  const first = renderHook(() => useImageUrl('one', load));
  await waitFor(() => expect(first.result.current).toBe('blob:1'));
  const second = renderHook(() => useImageUrl('one', load));
  expect(second.result.current).toBe('blob:1');
  expect(load).toHaveBeenCalledTimes(1);
});

it('stays empty for a missing image and tries again later', async () => {
  const load = vi.fn(async () => undefined);
  const { result, unmount } = renderHook(() => useImageUrl('lost', load));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(result.current).toBeUndefined();
  unmount();
  renderHook(() => useImageUrl('lost', load));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
});
