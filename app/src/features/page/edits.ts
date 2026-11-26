// Light hand-editing. Every function returns a new page and leaves the one given alone.
import type { FrameId, Item, Page } from '../../engine/types';

export type PieceAction = 'rot-l' | 'rot-r' | 'smaller' | 'bigger' | 'front' | 'delete';

const change = (p: Page, id: string, fn: (it: Item) => Item): Page =>
  (p.items.some((i) => i.id === id) ? { ...p, items: p.items.map((i) => (i.id === id ? fn(i) : i)) } : p);

export function applyAction(p: Page, id: string, action: PieceAction): Page {
  const item = p.items.find((i) => i.id === id);
  if (!item) return p;
  if (action === 'delete') {
    return {
      ...p,
      items: p.items.filter((i) => i.id !== id),
      cards: item.type === 'photo' ? p.cards.filter((c) => c.id !== item.cardId) : p.cards,   // frees one of the page's image slots
    };
  }
  return change(p, id, (it) => {
    if (action === 'rot-l') return { ...it, rot: it.rot - 6 };
    if (action === 'rot-r') return { ...it, rot: it.rot + 6 };
    if (action === 'front') return { ...it, z: Math.max(...p.items.map((i) => i.z)) + 1 };
    const f = action === 'bigger' ? 1.08 : 0.92;
    return { ...it, w: Math.round(it.w * f), h: Math.round(it.h * f) };
  });
}
export const moveItem = (p: Page, id: string, x: number, y: number): Page => change(p, id, (it) => ({ ...it, x, y }));
export const setFrame = (p: Page, id: string, frame: FrameId): Page => change(p, id, (it) => (it.type === 'photo' ? { ...it, frame } : it));
export const setCaption = (p: Page, cardId: string, caption: string): Page => ({ ...p, cards: p.cards.map((c) => (c.id === cardId ? { ...c, caption } : c)) });
