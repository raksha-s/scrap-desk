// Answers → art direction → laid-out page → saved. The page and any new folder appear together or not at all.
import { uid } from '../../engine/ids';
import { layoutPage, type MeasureNote } from '../../engine/layout';
import { art } from '../../engine/manifest';
import type { Card, Director, Page } from '../../engine/types';
import { newFolder, type Store } from '../../state/store';
import type { Draft } from './form';

export class SaveFailed extends Error {}

interface Deps {
  store: Store; director: Director; measureNote: MeasureNote;
  /** narration on the "reading your story" screen; `chips` null keeps the ones showing */
  onStep?(line: string, sub: string, chips: string[] | null, ms: number): Promise<void>;
}

export async function generatePage(d: Draft, { store, director, measureNote, onStep }: Deps): Promise<Page> {
  const story = d.story.trim();
  const start = d.start, end = d.kind === 'range' ? d.end : d.start;
  const dir = await director.direct({ story, start, end, cardCount: d.photos.length });
  const say = async (line: string, sub: string, chips: string[] | null, ms: number) => { await onStep?.(line, sub, chips, ms); };

  if (story) {
    await say('Reading your story…', '', null, 650);
    await say('Feeling it out', `“${dir.mood.summary}”`, [...dir.mood.chips, ...dir.themes.slice(0, 3)], 1150);
  } else await say('No words yet — letting the photos lead…', '', null, 700);
  const seals = dir.stickers.stamps.length;
  await say('Choosing flowers, seals & tape', '', [`${dir.palette.tape} tape`, `${dir.stickers.flowers.length} pressed flowers`, `${seals} wax seal${seals > 1 ? 's' : ''}`, 'one cat'], 800);
  await say('Arranging the page…', '', null, 450);

  const folder = d.folder === 'new' ? newFolder(d.newName, store.get().folders.map((f) => f.skin)) : undefined;
  const folderId = folder?.id ?? d.folder!;
  const cards: Card[] = d.photos.map((p) => ({ id: uid('c'), kind: 'photo', imageId: p.id, w: p.width, h: p.height }));
  const { items } = layoutPage({ direction: dir, cards, story }, { art, measureNote });
  const now = Date.now();
  const page: Page = { id: uid('p'), folderId, start, end, story, cards, direction: dir, items, createdAt: now, updatedAt: now };
  const images = d.photos.map(({ url: _url, ...image }) => image);
  try { await store.addPage(page, images, folder); }
  catch (cause) { throw new SaveFailed('could not save the page', { cause }); }
  return page;
}
