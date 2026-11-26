// Pieces added to a finished page: a photo card (camera shot, album cover) or a hand-picked sticker.
// Neither changes the page it is given; the caller adds the returned items.
import { cardSize, findSpot } from './layout';
import { uid } from './ids';
import { hashStr } from './rng';
import type { ArtIndex, ArtItem, ArtList, ArtType, Card, Item, Page, PhotoItem, TapeItem } from './types';

// longest side, in sheet units, of a hand-picked sticker, and the manifest list each type comes from
const PICKED: Record<ArtType, [ArtList, number]> = {
  cat: ['cats', 220], flower: ['flowers', 165], stamp: ['stamps', 140], sticker: ['stickers', 150], leaf: ['leaves', 280], paper: ['papers', 300], pattern: ['patterns', 340],
};

/** Drops a picked sticker into the clearest spot, above everything so it can be seen and dragged. */
export function placeSticker(page: Page, type: ArtType, artId: string, art: ArtIndex): ArtItem {
  const [list, long] = PICKED[type]; const a = art[list][artId];
  const k = long / Math.max(a.w, a.h); const w = Math.round(a.w * k), h = Math.round(a.h * k);
  const id = uid('i'); const spot = findSpot(page.items, w, h, hashStr(id));
  const z = Math.max(50, ...page.items.map((i) => i.z)) + 1;
  return { id, type, art: artId, x: spot.x, y: spot.y, w, h, rot: spot.rot, z, d: 0, picked: true };
}

/** A new photo card with its strip of tape. It shrinks until there is clear space, so it never hides an existing photo. */
export function placeCard(page: Page, card: Card): [PhotoItem, TapeItem] {
  let w = 320, h = 0, spot = { x: 0, y: 0, rot: 0, score: 0 };
  for (const tryW of [320, 270, 230, 200, 175]) {
    w = tryW; ({ h } = cardSize(card, w));
    spot = findSpot(page.items, w, h, hashStr(card.id) + tryW);
    if (spot.score > -120) break;
  }
  const z = Math.max(10, ...page.items.map((i: Item) => i.z)) + 2;
  const photo: PhotoItem = { id: uid('i'), type: 'photo', cardId: card.id, frame: 'polaroid', x: spot.x, y: spot.y, w, h, rot: spot.rot, z, d: 0, torn: 'none' };
  const tape: TapeItem = { id: uid('i'), type: 'tape', kind: page.direction.palette.tape, x: spot.x, y: spot.y - h / 2 + 8, w: 128, h: 38, rot: spot.rot + (spot.rot > 0 ? -6 : 6), z: z + 1, d: 0 };
  return [photo, tape];
}
