// The three things the bottom bar adds: music cover, instant photo, sticker.
import { useEffect, useRef, useState } from 'react';
import type { Page } from '../../engine/types';
import { importImage } from '../../images/import';
import { useStore } from '../../state/useApp';
import { toast } from '../../ui/toast';
import { AlbumDialog } from '../album/AlbumDialog';
import { fetchCover, searchAlbums, type AlbumHit } from '../album/search';
import { CameraDialog } from '../camera/CameraDialog';
import { StickerDialog } from '../stickers/StickerDialog';
import { addCard, addSticker, imagesFull, MAX_IMAGES } from './addPiece';
import { Tray, type Tool } from './Tray';

export interface PageServices { searchAlbums: typeof searchAlbums; fetchCover(url: string): ReturnType<typeof fetchCover>; importImage(b: Blob): ReturnType<typeof importImage> }
export const SERVICES: PageServices = { searchAlbums, fetchCover: (url) => fetchCover(url), importImage: (b) => importImage(b) };
const FULL = `This page already has ${MAX_IMAGES} images. Delete one to add another.`;

export function usePageTools(page: Page | undefined, shown: string | null, select: (id: string) => void, services: PageServices) {
  const store = useStore();
  const [tool, setTool] = useState<Tool | null>(null);
  const [addedIds, setAdded] = useState<string[]>([]);       // these drop onto the page
  const [freshCardId, setFresh] = useState<string>();         // this one develops
  const target = useRef('');                                  // the page the open dialog was started from
  const showing = useRef(shown); showing.current = shown;
  const later = useRef(0);

  useEffect(() => { setTool(null); setAdded([]); setFresh(undefined); return () => clearTimeout(later.current); }, [shown]);

  const land = (pageId: string, ids: string[]) => { if (showing.current === pageId) setAdded((a) => [...a, ...ids]); };

  const open = (t: Tool) => {
    if (!page) return;
    if (t === 'camera' && imagesFull(page)) { toast(FULL); return; }
    target.current = page.id; setTool(t);
  };

  async function onCover(hit: AlbumHit) {
    const to = target.current; setTool(null);
    toast('Getting that cover…', 20_000);
    let image;
    try { image = await services.fetchCover(hit.cover); }
    catch (e) { console.error(e); toast("Couldn't download that cover. Try another."); return; }
    const ids = addCard(store, to, 'album', image, { title: hit.title, artist: hit.artist });
    if (!ids) return;
    land(to, ids); toast(`Added “${hit.title}”. Drag it, tap the caption to rename.`);
  }

  async function onShot(picture: Blob) {
    const to = target.current; setTool(null);
    let image;
    try { image = await services.importImage(picture); }
    catch (e) { console.error(e); toast("Couldn't read that picture. Try another."); return; }
    const ids = addCard(store, to, 'camera', image);
    const now = store.get().pages.find((p) => p.id === to);
    if (!ids) { if (now) toast(FULL); return; }
    if (showing.current === to) setFresh(now!.cards.at(-1)!.id);
    land(to, ids); toast('Developing… give it a few seconds.');
  }

  function onSticker(type: Parameters<typeof addSticker>[2], artId: string) {
    const to = target.current; setTool(null);
    const id = addSticker(store, to, type, artId);
    if (!id) return;
    land(to, [id]);
    // once it has landed, show its controls
    later.current = window.setTimeout(() => { if (showing.current === to) select(id); }, 720);
  }

  const close = () => setTool(null);
  return {
    addedIds, freshCardId,
    tray: <Tray full={!!page && imagesFull(page)} onTool={open} />,
    dialogs: (
      <>
        <AlbumDialog open={tool === 'album'} search={services.searchAlbums} onPick={onCover} onClose={close} />
        <CameraDialog open={tool === 'camera'} onShot={onShot} onClose={close} />
        <StickerDialog open={tool === 'stickers'} onPick={onSticker} onClose={close} />
      </>
    ),
  };
}
