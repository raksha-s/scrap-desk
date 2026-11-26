// Putting something new on a stored page. The page may have changed, or gone, since the person asked for it.
import { uid } from '../../engine/ids';
import { art } from '../../engine/manifest';
import { placeCard, placeSticker } from '../../engine/place';
import type { ArtType, Card, Page } from '../../engine/types';
import type { Store } from '../../state/store';
import type { StoredImage } from '../../storage/repo';

export const MAX_IMAGES = 6;
/** A page holds up to six images; album covers don't count. */
export const imagesFull = (p: Page): boolean => p.cards.filter((c) => c.kind !== 'album').length >= MAX_IMAGES;

/** The new items' ids, or null if the page is gone or already full. */
export function addCard(store: Store, pageId: string, kind: 'camera' | 'album', image: StoredImage, album?: { title: string; artist: string }): string[] | null {
  const page = store.get().pages.find((p) => p.id === pageId);
  if (!page || (kind === 'camera' && imagesFull(page))) return null;
  const size = kind === 'album' ? { w: 500, h: 500 } : { w: image.width, h: image.height };
  const card: Card = { id: uid('c'), kind, imageId: image.id, ...size, ...(album ? { album } : {}) };
  const items = placeCard(page, card);
  store.updatePage(pageId, (p) => ({ ...p, cards: [...p.cards, card], items: [...p.items, ...items] }), [image]);
  return items.map((i) => i.id);
}

export function addSticker(store: Store, pageId: string, type: ArtType, artId: string): string | null {
  const page = store.get().pages.find((p) => p.id === pageId);
  if (!page) return null;
  const item = placeSticker(page, type, artId, art);
  store.updatePage(pageId, (p) => ({ ...p, items: [...p.items, item] }));
  return item.id;
}
