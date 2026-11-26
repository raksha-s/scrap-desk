import { describe, expect, it, vi } from 'vitest';
import { fetchCover, searchAlbums } from './search';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const mb = { 'release-groups': [{ id: 'g1', title: 'Blue', 'artist-credit': [{ name: 'Joni' }] }, { id: 'live', title: 'Blue Live', 'secondary-types': ['Live'] }] };
const itunes = { results: [{ collectionId: 7, collectionName: 'Blue', artistName: 'Joni', artworkUrl100: 'https://x/100x100bb.jpg' }] };
const net = (a: () => Response | Promise<Response>, b: () => Response | Promise<Response>) =>
  vi.fn(async (url: string | URL | Request) => (String(url).includes('musicbrainz') ? a() : b())) as unknown as typeof fetch;
const down = () => { throw new TypeError('offline'); };
const signal = new AbortController().signal;

describe('album search', () => {
  it('uses MusicBrainz and the Cover Art Archive', async () => {
    const f = net(() => ok(mb), down);
    const r = await searchAlbums('blue', signal, f);
    expect(r.status).toBe('Showing MusicBrainz + Cover Art Archive. Albums without art are hidden.');
    expect(r.list).toEqual([{ key: 'g1', title: 'Blue', artist: 'Joni', thumb: 'https://coverartarchive.org/release-group/g1/front-250', cover: 'https://coverartarchive.org/release-group/g1/front-500' }]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('turns to iTunes when MusicBrainz has nothing', async () => {
    const r = await searchAlbums('blue', signal, net(() => ok({ 'release-groups': [] }), () => ok(itunes)));
    expect(r.status).toBe('Showing iTunes Search (fallback). Albums without art are hidden.');
    expect(r.list[0]).toMatchObject({ thumb: 'https://x/300x300bb.jpg', cover: 'https://x/600x600bb.jpg' });
  });
  it('turns to iTunes when MusicBrainz fails', async () => {
    const r = await searchAlbums('blue', signal, net(() => new Response('', { status: 503 }), () => ok(itunes)));
    expect(r.status).toBe('MusicBrainz didn’t answer — showing iTunes Search instead.');
    expect(r.list).toHaveLength(1);
  });
  it('says when nothing is found or nothing answers', async () => {
    expect((await searchAlbums('zzz', signal, net(() => ok({}), () => ok({ results: [] })))).status).toBe('Nothing found for “zzz”. Try the artist name.');
    expect(await searchAlbums('zzz', signal, net(down, down))).toEqual({ list: [], status: 'Couldn’t reach the cover services. Check your connection and try again.' });
  });
  it('lets a cancelled search stay cancelled', async () => {
    const f = (async () => { throw new DOMException('stop', 'AbortError'); }) as unknown as typeof fetch;
    await expect(searchAlbums('blue', signal, f)).rejects.toThrow('stop');
  });
});

describe('downloading a cover', () => {
  const codec = { decode: async () => ({ width: 500, height: 500, source: {} as CanvasImageSource }), encode: async () => new Blob(['small'], { type: 'image/jpeg' }) };
  it('stores a copy of the picture', async () => {
    const img = await fetchCover('https://x/cover.jpg', (async () => new Response('bytes')) as unknown as typeof fetch, codec);
    expect(img).toMatchObject({ width: 500, height: 500 });
  });
  it('rejects a cover that cannot be downloaded', async () => {
    await expect(fetchCover('https://x/none.jpg', (async () => new Response('', { status: 404 })) as unknown as typeof fetch, codec)).rejects.toThrow('404');
  });
});
