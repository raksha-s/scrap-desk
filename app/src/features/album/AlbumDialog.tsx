import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '../../ui/Dialog';
import type { AlbumHit, searchAlbums } from './search';

interface Props { open: boolean; search: typeof searchAlbums; onPick(hit: AlbumHit): void; onClose(): void }

export function AlbumDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} className="dlg dlg-album" id="albumDlg" labelledBy="aTitle">
      <Search {...props} />
    </Dialog>
  );
}

function Search({ search, onPick, onClose }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Covers come from MusicBrainz & the Cover Art Archive (open source).');
  const [list, setList] = useState<AlbumHit[]>([]);
  const [broken, setBroken] = useState<string[]>([]);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  // after the dialog has opened: opening it moves the focus to its first button
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => field.current?.focus(), 60); return () => clearTimeout(t); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); const q = text.trim(); if (!q) return;
    running.current?.abort(); const ctl = running.current = new AbortController();
    setStatus('Searching…'); setList([]); setBroken([]);
    try {
      const found = await search(q, ctl.signal);
      if (!ctl.signal.aborted) { setList(found.list); setStatus(found.status); }
    } catch { /* cancelled by a newer search or by closing */ }
  }

  return (
    <>
      <header className="dlg-head"><h2 id="aTitle">Add an album cover</h2><button type="button" className="x" aria-label="Close" onClick={onClose}>×</button></header>
      <form className="album-search" id="albumForm" role="search" onSubmit={submit}>
        <input type="search" id="albumQ" ref={field} placeholder="Album, song or artist" autoComplete="off" enterKeyHint="search" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="key key-sm"><span>Search</span></button>
      </form>
      <p className="mono-meta" id="albumStatus">{status}</p>
      <ul className="album-grid" id="albumGrid">
        {list.filter((a) => !broken.includes(a.key)).map((a) => (
          <li key={a.key}>
            <button type="button" onClick={() => onPick(a)}>
              <img src={a.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, a.key])} />
              <b>{a.title}</b><small>{a.artist}</small>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
