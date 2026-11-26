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
