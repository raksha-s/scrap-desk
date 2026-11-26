// Album covers: MusicBrainz (search) + Cover Art Archive (images) — both open source.
// If MusicBrainz is unreachable we fall back to the iTunes Search API (free, no key).
import { $, wireDialog } from './ui.js';

const dlg = $('#albumDlg'), form = $('#albumForm'), q = $('#albumQ'), grid = $('#albumGrid'), status = $('#albumStatus');
const OPEN = 'Covers come from MusicBrainz & the Cover Art Archive (open source).';
let resolver, ctl;

const clean = (s) => s.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

async function mb(text, signal) {
  const t = clean(text);
  const query = `releasegroup:(${t})^4 OR artist:(${t})`;
  const r = await fetch(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=18`, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`MusicBrainz ${r.status}`);
  const j = await r.json();
  return (j['release-groups'] || []).filter((g) => !g['secondary-types']?.length).map((g) => ({
    key: g.id, title: g.title, artist: g['artist-credit']?.map((a) => a.name).join(', ') || 'Unknown artist',
    thumb: `https://coverartarchive.org/release-group/${g.id}/front-250`, cover: `https://coverartarchive.org/release-group/${g.id}/front-500`,
  }));
}
async function itunes(text, signal) {
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(text)}&entity=album&limit=18`, { signal });
  if (!r.ok) throw new Error(`iTunes ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((a) => ({ key: a.collectionId, title: a.collectionName, artist: a.artistName, thumb: a.artworkUrl100.replace('100x100bb', '300x300bb'), cover: a.artworkUrl100.replace('100x100bb', '600x600bb') }));
}

function show(list) {
  grid.innerHTML = '';
  let shown = 0;
  for (const a of list) {
    const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
    const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    img.onerror = () => li.remove(); img.onload = () => { shown++; };
    img.src = a.thumb;
    const t = document.createElement('b'); t.textContent = a.title; const s = document.createElement('small'); s.textContent = a.artist;
    b.append(img, t, s); li.append(b); grid.append(li);
    b.addEventListener('click', () => { const r = resolver; resolver = null; dlg.close(); r?.({ title: a.title, artist: a.artist, cover: a.cover }); });
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault(); const text = q.value.trim(); if (!text) return;
  ctl?.abort(); ctl = new AbortController();
  status.textContent = 'Searching…'; grid.innerHTML = '';
  try {
    let list = await mb(text, ctl.signal); let via = 'MusicBrainz + Cover Art Archive';
    if (!list.length) { list = await itunes(text, ctl.signal); via = 'iTunes Search (fallback)'; }
    if (!list.length) { status.textContent = `Nothing found for “${text}”. Try the artist name.`; return; }
    status.textContent = `Showing ${via}. Albums without art are hidden.`; show(list);
  } catch (err) {
    if (err.name === 'AbortError') return;
    try { const list = await itunes(text, ctl.signal); status.textContent = 'MusicBrainz didn’t answer — showing iTunes Search instead.'; show(list); }
    catch { status.textContent = 'Couldn’t reach the cover services. Check your connection and try again.'; }
  }
});
document.querySelectorAll('#albumDlg [data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
wireDialog(dlg);
dlg.addEventListener('close', () => { ctl?.abort(); if (resolver) { const r = resolver; resolver = null; r(null); } });

export function openAlbum() {
  q.value = ''; grid.innerHTML = ''; status.textContent = OPEN;
  dlg.showModal(); setTimeout(() => q.focus(), 60);
  return new Promise((res) => { resolver = res; });
}
