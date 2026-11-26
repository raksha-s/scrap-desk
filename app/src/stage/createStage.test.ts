// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createStage } from './createStage';

it('is null where there is no WebGL', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const canvas = document.createElement('canvas');
  canvas.getContext = (() => null) as typeof canvas.getContext;
  expect(createStage(canvas)).toBeNull();
  expect(String(warn.mock.calls[0][1])).toMatch(/WebGL/i);
  vi.restoreAllMocks();
});
