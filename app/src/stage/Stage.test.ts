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

const quietPen = () => {
  const pen = { clearRect() {}, fillText() {}, measureText: () => ({ width: 10 }), drawImage() {} };
  HTMLCanvasElement.prototype.getContext = (() => pen) as unknown as typeof HTMLCanvasElement.prototype.getContext;
};
const screenSize = (width: number, height: number) => { vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height); };
const folders = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, name: `Folder ${i}`, skin: 'f03', pages: 0, peek: null }));

it.each([
  [320, 568, 1], [390, 844, 1], [390, 844, 3], [390, 844, 8], [430, 932, 2],
])('on a %i×%i phone the folders rise from the bottom edge (%i of them)', (width, height, n) => {
  quietPen(); screenSize(width, height);
  const stage = createStage(document.createElement('canvas'))!;
  stage.setFolders(folders(n));
  const at = (y: number) => stage.hitTest(width / 2, y);
  expect(at(height - 1)).toBeGreaterThanOrEqual(0);         // runs off the bottom of the screen
  expect(at(height * 0.5)).toBe(-1);                        // and leaves the upper half to the name and the toggle
  expect(at(height * 0.85)).toBeGreaterThanOrEqual(0);
  stage.dispose(); vi.unstubAllGlobals();
});

// inside a folder the page cards are laid out in HTML over the 3D folder, so the two have to agree at every size
const SCREENS: [number, number][] = [[320, 568], [390, 844], [720, 900], [820, 1100], [946, 792], [1024, 1366], [1440, 800], [1920, 1080], [2560, 1440]];
const insideFolder = (width: number, height: number) => {
  quietPen(); screenSize(width, height);
  const stage = createStage(document.createElement('canvas'))!;
  stage.setFolders(folders(1)); stage.setView('folder', 0); stage.snap();
  const { body, cur } = (stage as unknown as { items: { body: { geometry: { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number }; max: { x: number; y: number } } } }; cur: { topY: number; s: number } }[] }).items[0];
  body.geometry.computeBoundingBox(); const box = body.geometry.boundingBox;
  return { stage, top: cur.topY, width: (box.max.x - box.min.x) * cur.s, height: (box.max.y - box.min.y) * cur.s };
};

it.each(SCREENS)('tells the page how wide the open folder is on a %i×%i screen', (w, h) => {
  const { stage, width } = insideFolder(w, h);
  const told = parseFloat(document.documentElement.style.getPropertyValue('--folder-w'));
  expect(Math.abs(told - width)).toBeLessThan(1);
  expect(told).toBeLessThanOrEqual(w);
  const front = parseFloat(document.documentElement.style.getPropertyValue('--folder-front'));
  expect(front).toBeGreaterThan(124); expect(front).toBeLessThan(h / 2);
  stage.dispose(); vi.unstubAllGlobals();
});

it.each(SCREENS)('reaches the bottom of a %i×%i screen when open', (w, h) => {
  const { stage, top, height } = insideFolder(w, h);
  expect(top + height).toBeGreaterThanOrEqual(h);
  stage.dispose(); vi.unstubAllGlobals();
});
