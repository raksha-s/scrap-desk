import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/golden.json';
import { describeDates } from './dates';
import { ruleDirector } from './director';
import { uid } from './ids';
import { art, folderSkins, nextSkin, SKIN_NAMES, SKIN_ORDER } from './manifest';

describe('describeDates', () => {
  it.each([
    ['2026-11-01', '2026-11-30', { title: 'November', chip: '1 – 30 Nov 2026', short: 'Nov 2026', span: 'month' }],
    ['2026-11-09', '2026-11-09', { title: '9 November', chip: 'Monday · 2026', short: '9 Nov 2026', span: 'day' }],
    ['2026-10-28', '2026-11-02', { title: 'Oct – Nov', chip: '28 Oct – 2 Nov 2026', short: 'Oct – Nov 2026', span: 'multi' }],
    ['2025-12-30', '2026-01-02', { title: '2025 – 2026', chip: '30 Dec 2025 – 2 Jan 2026', short: 'Dec 2025 – Jan 2026', span: 'multi' }],
  ])('describes %s to %s', (a, b, want) => expect(describeDates(a, b)).toEqual(want));
});

describe('rule director', () => {
  it.each(golden)('directs like the prototype: $name', async (g) => {
    expect(await ruleDirector.direct(g.input)).toEqual(g.direction);
  });

  it('reads the sample arc', async () => {
    const d = await ruleDirector.direct(golden[0].input);
    expect(d.mood.arc).toBe('heavy-warm');
    expect(d.quote).toBe('I will cherish it all');
  });
});

describe('assets', () => {
  it('serves every piece of art from art/', () => {
    const files = [...Object.values(art).flatMap((t) => Object.values(t).map((a) => a.file)), ...Object.values(folderSkins).map((f) => f.file)];
    expect(files.length).toBeGreaterThan(150);
    expect(files.filter((f) => !f.startsWith('art/'))).toEqual([]);
  });

  it('names all eleven folder colours', () => {
    expect(SKIN_ORDER).toHaveLength(11);
    expect(SKIN_ORDER.filter((s) => !folderSkins[s] || !SKIN_NAMES[s])).toEqual([]);
  });

  it('gives the next folder an unused colour, then cycles', () => {
    expect(nextSkin([])).toBe('f03');
    expect(nextSkin(['f03', 'f09'])).toBe('f05');
    expect(nextSkin([...SKIN_ORDER])).toBe(SKIN_ORDER[0]);
  });
});

it('makes ids that never repeat, even in the same instant', () => {
  const ids = new Set(Array.from({ length: 500 }, () => uid('p')));
  expect(ids.size).toBe(500);
  expect([...ids][0].startsWith('p')).toBe(true);
});
