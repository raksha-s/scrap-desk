import { describe, expect, it } from 'vitest';
import { card, page } from '../../test/fixtures';
import { applyAction, moveItem, setCaption, setFrame } from './edits';
import { fitScale, stepZoom, ZOOM_STEPS } from './zoom';

const p = page('p', 'f', [card('a'), card('b')]);
const item = (x: typeof p) => x.items.find((i) => i.id === 'it-a')!;
const was = item(p);

describe('editing pieces', () => {
  it('rotates by six degrees', () => {
    expect(item(applyAction(p, 'it-a', 'rot-r')).rot).toBe(was.rot + 6);
    expect(item(applyAction(p, 'it-a', 'rot-l')).rot).toBe(was.rot - 6);
  });
  it('resizes by eight percent', () => {
    expect(item(applyAction(p, 'it-a', 'bigger')).w).toBe(Math.round(was.w * 1.08));
    expect(item(applyAction(p, 'it-a', 'bigger')).h).toBe(Math.round(was.h * 1.08));
    expect(item(applyAction(p, 'it-a', 'smaller')).w).toBe(Math.round(was.w * 0.92));
  });
  it('brings to the front', () => {
    expect(item(applyAction(p, 'it-a', 'front')).z).toBe(Math.max(...p.items.map((i) => i.z)) + 1);
  });
  it('deletes a photo and frees its image slot', () => {
    const next = applyAction(p, 'it-a', 'delete');
    expect(next.items.map((i) => i.id)).toEqual(['it-b']);
    expect(next.cards.map((c) => c.id)).toEqual(['b']);
  });
  it('moves, reframes and captions without touching the original', () => {
    const before = structuredClone(p);
    expect(item(moveItem(p, 'it-a', 10, 20))).toMatchObject({ x: 10, y: 20 });
    expect(item(setFrame(p, 'it-a', 'film'))).toMatchObject({ frame: 'film' });
    expect(setCaption(p, 'a', '').cards[0].caption).toBe('');
    expect(applyAction(p, 'nothing', 'front')).toBe(p);
    expect(p).toEqual(before);
  });
});

describe('zoom', () => {
  it('steps through the set sizes and stops at the ends', () => {
    expect(ZOOM_STEPS).toEqual([50, 75, 100, 125, 150, 200, 250, 300]);
    expect(stepZoom(100, 1)).toBe(125);
    expect(stepZoom(110, -1)).toBe(100);
    expect(stepZoom(300, 1)).toBe(300);
    expect(stepZoom(50, -1)).toBe(50);
  });
  it('fits the sheet between the keys', () => {
    expect(fitScale(928, 1240, 0, 0)).toBe(1);
    expect(fitScale(5000, 5000, 0, 0)).toBe(1.05);
    expect(fitScale(478, 5000, 0, 0)).toBe(0.5);
    expect(fitScale(5000, 800, 100, 80)).toBe(0.5);
  });
});
