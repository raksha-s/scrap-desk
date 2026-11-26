// Album covers: MusicBrainz (search) + Cover Art Archive (images), both open source.
// If MusicBrainz is unreachable or has nothing, the iTunes Search API (free, no key).
import { importImage, type Codec } from '../../images/import';
import type { StoredImage } from '../../storage/repo';

export interface AlbumHit { key: string; title: string; artist: string; thumb: string; cover: string }

const clean = (s: string) => s.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

async function musicBrainz(text: string, signal: AbortSignal, f: typeof fetch): Promise<AlbumHit[]> {
  const t = clean(text);
  const query = `releasegroup:(${t})^4 OR artist:(${t})`;
  const r = await f(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=18`, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`MusicBrainz ${r.status}`);
  const j = await r.json() as { 'release-groups'?: { id: string; title: string; 'secondary-types'?: string[]; 'artist-credit'?: { name: string }[] }[] };
  return (j['release-groups'] || []).filter((g) => !g['secondary-types']?.length).map((g) => ({
    key: g.id, title: g.title, artist: g['artist-credit']?.map((a) => a.name).join(', ') || 'Unknown artist',
    thumb: `https://coverartarchive.org/release-group/${g.id}/front-250`, cover: `https://coverartarchive.org/release-group/${g.id}/front-500`,
  }));
}

async function iTunes(text: string, signal: AbortSignal, f: typeof fetch): Promise<AlbumHit[]> {
  const r = await f(`https://itunes.apple.com/search?term=${encodeURIComponent(text)}&entity=album&limit=18`, { signal });
  if (!r.ok) throw new Error(`iTunes ${r.status}`);
  const j = await r.json() as { results?: { collectionId: number; collectionName: string; artistName: string; artworkUrl100: string }[] };
  return (j.results || []).map((a) => ({
    key: String(a.collectionId), title: a.collectionName, artist: a.artistName,
    thumb: a.artworkUrl100.replace('100x100bb', '300x300bb'), cover: a.artworkUrl100.replace('100x100bb', '600x600bb'),
  }));
}

const cancelled = (e: unknown) => (e as Error).name === 'AbortError';

export async function searchAlbums(text: string, signal: AbortSignal, f: typeof fetch = (...a) => fetch(...a)): Promise<{ list: AlbumHit[]; status: string }> {
  let fellBack = false;
  try {
    const list = await musicBrainz(text, signal, f);
    if (list.length) return { list, status: 'Showing MusicBrainz + Cover Art Archive. Albums without art are hidden.' };
  } catch (e) { if (cancelled(e)) throw e; fellBack = true; }
  try {
    const list = await iTunes(text, signal, f);
    if (!list.length) return { list, status: `Nothing found for “${text}”. Try the artist name.` };
    return { list, status: fellBack ? 'MusicBrainz didn’t answer — showing iTunes Search instead.' : 'Showing iTunes Search (fallback). Albums without art are hidden.' };
  } catch (e) {
    if (cancelled(e)) throw e;
    return { list: [], status: 'Couldn’t reach the cover services. Check your connection and try again.' };
  }
}

/** A stored copy of a cover, so old pages never depend on the internet. */
export async function fetchCover(url: string, f: typeof fetch = (...a) => fetch(...a), codec?: Codec): Promise<StoredImage> {
  const r = await f(url, { referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`cover ${r.status}`);
  return importImage(await r.blob(), codec);
}
