import golden from '../engine/__fixtures__/golden.json';
import type { ArtDirection, Card, Folder, Item, Page } from '../engine/types';
import type { StoredImage } from '../storage/repo';

export const folder = (id: string, createdAt = 1): Folder => ({ id, name: id, skin: 'f03', createdAt });

export const image = (id: string, text = id): StoredImage => ({ id, blob: new Blob([text], { type: 'image/jpeg' }), width: 40, height: 30 });

export const card = (id: string, imageId = `img-${id}`, kind: Card['kind'] = 'photo'): Card => ({ id, kind, imageId, w: 1000, h: 750 });

export function page(id: string, folderId: string, cards: Card[] = [], createdAt = 1): Page {
  const direction = structuredClone(golden[0].direction) as unknown as ArtDirection;
  const items: Item[] = cards.map((c, i) => ({ id: `it-${c.id}`, type: 'photo', cardId: c.id, frame: 'polaroid', torn: 'none', x: 200 + i * 40, y: 300, w: 300, h: 300, rot: 2, z: 10 + i, d: 0 }));
  return { id, folderId, start: '2026-11-01', end: '2026-11-30', story: 'A story.', cards, direction, items, createdAt, updatedAt: createdAt };
}
