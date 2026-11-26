import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/golden.json';
import { ruleDirector } from './director';
import { bbox, cardSize, findSpot, layoutPage, type MeasureNote } from './layout';
import { art } from './manifest';
import { placeCard, placeSticker } from './place';
import type { ArtDirection, Card, Page } from './types';

// roughly what the handwriting face measures, so long stories get tall notes
const estimate: MeasureNote = (text, _sig, w, fs, lh) => (Math.ceil(text.length / Math.floor((w - 40) / (fs * 0.42))) + 2) * lh + 40;
const cardsOf = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: 'photo', imageId: `m${i}`, w: i % 2 ? 750 : 1000, h: i % 2 ? 1000 : 750 }));
const SAMPLE = golden[0].input.story;

describe('layout', () => {
  it.each(golden)('lays out like the prototype: $name', (g) => {
    const { items } = layoutPage(g.args as unknown as { direction: ArtDirection; cards: Card[]; story: string }, { art, measureNote: () => 260 });
    expect(items).toEqual(g.items);
  });

  const stories = ['', 'A short day.', SAMPLE.slice(0, 200), SAMPLE.slice(0, 400), `${SAMPLE} ${SAMPLE} ${SAMPLE}`.slice(0, 900)];
  // one test per story length: 56 full layouts each, a second or so normally and far longer on a busy machine
  it.each(stories.map((s) => [s.length, s] as const))('keeps title, note and quote apart and on the sheet (%i characters)', async (_length, story) => {
    const overlaps: string[] = []; const offSheet: string[] = [];
    for (let n = 0; n <= 6; n++) for (let day = 1; day <= 8; day++) {
      const date = `2026-11-0${day}`;
      const direction = await ruleDirector.direct({ story, start: date, end: date, cardCount: n });
      const { items } = layoutPage({ direction, cards: cardsOf(n), story }, { art, measureNote: estimate });
      const text = items.filter((i) => i.type === 'title' || i.type === 'note' || i.type === 'quote');
      const where = `${n} photos, ${date}`;
      text.forEach((a, i) => {
        const x = bbox(a);
        if (x.x0 < 0 || x.y0 < 0 || x.x1 > 900 || x.y1 > 1200) offSheet.push(`${where}: ${a.type}`);
        for (const b of text.slice(i + 1)) {
          const y = bbox(b);
          if (Math.min(x.x1, y.x1) - Math.max(x.x0, y.x0) > 1 && Math.min(x.y1, y.y1) - Math.max(x.y0, y.y0) > 1) overlaps.push(`${where}: ${a.type} over ${b.type}`);
        }
      });
    }
    expect(overlaps).toEqual([]);
    expect(offSheet).toEqual([]);
  }, 120_000);

  it('sizes a card to its photo shape', () => {
    expect(cardSize({ kind: 'photo', w: 1000, h: 750 }, 328)).toEqual({ w: 328, h: 297 });
    expect(cardSize({ kind: 'album', w: 500, h: 500 }, 328)).toEqual({ w: 328, h: 372 });
  });
});

async function samplePage(): Promise<Page> {
  const direction = await ruleDirector.direct({ story: SAMPLE, start: '2026-11-01', end: '2026-11-30', cardCount: 2 });
  const cards = cardsOf(2);
  const { items } = layoutPage({ direction, cards, story: SAMPLE }, { art, measureNote: estimate });
  return { id: 'p1', folderId: 'f1', start: '2026-11-01', end: '2026-11-30', story: SAMPLE, cards, direction, items, createdAt: 1, updatedAt: 1 };
}

describe('placing pieces later', () => {
  const card: Card = { id: 'new', kind: 'camera', imageId: 'img', w: 1280, h: 960 };

  it('adds a camera card with tape above everything, without touching the page', async () => {
    const page = await samplePage(); const before = structuredClone(page);
    const [photo, tape] = placeCard(page, card);
    expect(photo).toMatchObject({ type: 'photo', cardId: 'new', frame: 'polaroid' });
    expect(tape.type).toBe('tape');
    expect(tape.z).toBeGreaterThan(photo.z);
    expect(photo.z).toBeGreaterThan(Math.max(...page.items.filter((i) => i.type === 'photo').map((i) => i.z)));
    expect(page).toEqual(before);
  });

  it('puts a picked sticker on top, sized for its kind', async () => {
    const page = await samplePage(); const before = structuredClone(page);
    const s = placeSticker(page, 'cat', Object.keys(art.cats)[0], art);
    expect(s.picked).toBe(true);
    expect(Math.max(s.w, s.h)).toBe(220);
    expect(s.z).toBeGreaterThan(Math.max(...page.items.map((i) => i.z)));
    expect(page).toEqual(before);
  });

  it('works on a page with nothing on it', async () => {
    const page = { ...(await samplePage()), items: [], cards: [] };
    expect(placeSticker(page, 'stamp', Object.keys(art.stamps)[0], art).z).toBe(51);
    expect(placeCard(page, card)[0].z).toBe(12);
  });

  it('finds a spot on the sheet', () => {
    const s = findSpot([], 200, 200, 7);
    expect(s.x).toBeGreaterThan(0); expect(s.y).toBeLessThan(1200);
  });
});
