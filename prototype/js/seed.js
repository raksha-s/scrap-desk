// Demo content so the prototype isn't empty. Your real sample story + photos, and a few placeholder pages.
import { manifest, store, addFolder, uid } from './data.js';
import { composePage } from './pages.js';

export const SAMPLE_STORY = 'November was quite depressing initially. But just as Diwali started, things started getting better, my friends came over to cook food and celebrate me moving out. I also celebrated Diwali with my family at home. I found a very cute and unique lady bug at office. I feel like not all was bad this month, there were some really dark days while there were some really beautiful days. I will cherish it all';

const card = (p) => ({ id: uid('c'), kind: 'photo', src: p.file, w: p.w, h: p.h });
export const samplePhotoCards = () => manifest.photos.map(card);

export async function seedDemo() {
  const nov = addFolder('November', 'f03');
  const fnf = addFolder('Friends & Food', 'f05');
  const work = addFolder('Work Days', 'f11');
  addFolder('Home', 'f09');
  addFolder('Unnamed Folder', 'f04');
  const P = manifest.photos;

  store.pages.push(await composePage({ folderId: nov.id, start: '2026-11-01', end: '2026-11-30', story: SAMPLE_STORY, cards: P.map(card) }));
  store.pages.push(await composePage({ folderId: fnf.id, start: '2026-11-09', end: '2026-11-09', story: 'Sunday khichdi with the gang. Too much salt, too much laughter. I want more days like this.', cards: [card(P[1])] }));
  store.pages.push(await composePage({ folderId: work.id, start: '2026-11-18', end: '2026-11-18', story: 'A tiny ladybug landed on my hand at the office today. Spotted, calm and perfectly timed. I felt lucky.', cards: [card(P[4]), card(P[2])] }));
}
