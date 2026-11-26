import { direct } from './director.js';
import { layoutPage, findSpot, cardSize } from './layout.js';
import { uid, art } from './data.js';
import { hashStr } from './rng.js';

export async function composePage({ folderId, start, end, story, cards }) {
  const direction = direct({ story, start, end, cardCount: cards.length });
  const { items } = await layoutPage({ direction, cards, story });
  return { id: uid('p'), folderId, start, end, story, cards, direction, items, createdAt: Date.now() };
}

// longest side, in sheet units, of a hand-picked sticker, and the manifest list each type comes from
const PICKED = { cat: ['cats', 220], flower: ['flowers', 165], stamp: ['stamps', 140], sticker: ['stickers', 150], leaf: ['leaves', 280], paper: ['papers', 300], pattern: ['patterns', 340] };

// drop a picked sticker into the clearest spot, above everything so it can be seen and dragged
export function addStickerToPage(page, type, artId) {
  const [list, long] = PICKED[type]; const a = art[list][artId];
  const k = long / Math.max(a.w, a.h); const w = Math.round(a.w * k), h = Math.round(a.h * k);
  const id = uid('i'); const spot = findSpot(page.items, w, h, hashStr(id));
  const z = Math.max(50, ...page.items.map((i) => i.z)) + 1;
  const item = { id, type, art: artId, x: spot.x, y: spot.y, w, h, rot: spot.rot, z, d: 0, picked: true };
  page.items.push(item);
  return item;
}

// put a freshly added card (album cover / camera shot) onto the page, with tape
export function addCardToPage(page, card) {
  page.cards.push(card);
  // try a comfortable size first, then shrink until there is clear space (never hide an existing photo)
  let w = 320, h, spot;
  for (const tryW of [320, 270, 230, 200, 175]) {
    w = tryW; ({ h } = cardSize(card, w));
    spot = findSpot(page.items, w, h, hashStr(card.id) + tryW);
    if (spot.score > -120) break;
  }
  const z = Math.max(10, ...page.items.map((i) => i.z)) + 2;
  const item = { id: uid('i'), type: 'photo', cardId: card.id, frame: 'polaroid', x: spot.x, y: spot.y, w, h, rot: spot.rot, z, d: 0, torn: 'none' };
  const tape = { id: uid('i'), type: 'tape', kind: page.direction.palette.tape, x: spot.x, y: spot.y - h / 2 + 8, w: 128, h: 38, rot: spot.rot + (spot.rot > 0 ? -6 : 6), z: z + 1, d: 0 };
  page.items.push(item, tape);
  return [item, tape];
}
