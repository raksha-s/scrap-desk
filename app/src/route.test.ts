import { describe, expect, it } from 'vitest';
import { parseRoute, resolveRoute } from './route';
import { folder, page } from './test/fixtures';

const state = { folders: [folder('abc')], pages: [page('p1', 'abc')] };

describe('routes', () => {
  it('reads the address', () => {
    expect(parseRoute('#/f/abc')).toEqual({ view: 'folder', id: 'abc' });
    expect(parseRoute('#/p/p1')).toEqual({ view: 'page', id: 'p1' });
    for (const hash of ['', '#/', '#/nonsense', '#/f/', '#/p']) expect(parseRoute(hash)).toEqual({ view: 'home' });
  });
  it('opens the desk for anything that no longer exists', () => {
    expect(resolveRoute({ view: 'page', id: 'gone' }, state)).toEqual({ view: 'home' });
    expect(resolveRoute({ view: 'folder', id: 'gone' }, state)).toEqual({ view: 'home' });
    expect(resolveRoute({ view: 'page', id: 'p1' }, state)).toEqual({ view: 'page', id: 'p1' });
    expect(resolveRoute({ view: 'folder', id: 'abc' }, state)).toEqual({ view: 'folder', id: 'abc' });
  });
});
