// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { folderSkins, skinFor } from '../engine/manifest';
import { createStage } from './createStage';

// only the graphics card is pretended; the rest of Three.js and the whole Stage are real
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class { outputColorSpace = ''; setClearColor() {} setPixelRatio() {} setSize() {} render() {} dispose() {} },
}));
afterEach(() => vi.restoreAllMocks());

it('falls back to a known folder colour', () => {
  expect(skinFor('f10')).toBe(folderSkins.f10);
  expect(skinFor('no-such-colour')).toBe(folderSkins.f03);
});

it('draws a folder whose saved colour no longer exists', () => {
  const pen = { clearRect() {}, fillText() {}, measureText: () => ({ width: 10 }), drawImage() {} };
  HTMLCanvasElement.prototype.getContext = (() => pen) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  const stage = createStage(document.createElement('canvas'))!;
  expect(() => stage.setFolders([{ id: 'a', name: 'Old', skin: 'gone', pages: 0, peek: null }])).not.toThrow();
  expect(() => stage.recolor(0, 'also-gone')).not.toThrow();
  stage.dispose();
});
