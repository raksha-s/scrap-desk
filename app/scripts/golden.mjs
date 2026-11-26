// Records what the approved prototype's engine produces, so the TypeScript port can be checked against it.
// Run from app/:  npm run golden
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const proto = new URL('../../prototype/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/manifest.json', proto), 'utf8'));

// the prototype's modules expect a browser: hand them the manifest, and a note that always measures 260 tall
globalThis.fetch = async () => ({ json: async () => manifest });
const element = () => ({ style: {}, append() {}, remove() {}, scrollHeight: 260 });
globalThis.document = { createElement: element, createTextNode: () => ({}), body: { append() {} } };

const { direct } = await import(new URL('js/director.js', proto));
const { layoutPage } = await import(new URL('js/layout.js', proto));

const SAMPLE = 'November was quite depressing initially. But just as Diwali started, things started getting better, my friends came over to cook food and celebrate me moving out. I also celebrated Diwali with my family at home. I found a very cute and unique lady bug at office. I feel like not all was bad this month, there were some really dark days while there were some really beautiful days. I will cherish it all';

const cases = [
  ['the sample month', SAMPLE, '2026-11-01', '2026-11-30', 5],
  ['no words, no photos', '', '2026-11-09', '2026-11-09', 0],
  ['a heavy day', 'A hard, lonely day at the office. I was tired and stressed and everything felt heavy.', '2026-11-18', '2026-11-18', 1],
  ['across two years', 'We travelled to the mountains, moved into a new home, and the nights were full of stars. It was a good, calm stretch.', '2025-12-30', '2026-01-02', 6],
  ['love', 'I love how you laughed. A sweet, beautiful evening with flowers and my favourite person.', '2026-02-14', '2026-02-14', 2],
  ['bright then dim', 'The party was wonderful and happy and full of friends. But later I felt sad, alone and very tired.', '2026-03-05', '2026-03-12', 3],
  ['a long entry', `${SAMPLE} ${SAMPLE} ${SAMPLE}`.slice(0, 900), '2026-10-28', '2026-11-02', 4],
];

const golden = [];
for (const [name, story, start, end, n] of cases) {
  const cards = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: 'photo', imageId: `m${i}`, src: '', w: i % 2 ? 750 : 1000, h: i % 2 ? 1000 : 750 }));
  const input = { story, start, end, cardCount: n };
  const direction = direct(input);
  const { items } = await layoutPage({ direction, cards, story });
  golden.push({ name, input, args: { direction, cards: cards.map(({ src, ...c }) => c), story }, direction, items });
}
writeFileSync(fileURLToPath(new URL('../src/engine/__fixtures__/golden.json', import.meta.url)), `${JSON.stringify(golden, null, 1)}\n`);
console.log(`${golden.length} reference pages recorded`);
