import { useEffect, useMemo, useState } from 'react';
import type { Folder, Page } from '../engine/types';
import { imageUrlFor } from '../images/urls';
import { useStore } from '../state/useApp';
import { peekImageId } from './sync';
import type { StageFolder } from './Stage';

/** The folders as the 3D desk needs them, with the peeking photos loaded. */
export function useStageFolders(folders: Folder[], pages: Page[]): StageFolder[] {
  const store = useStore();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const wanted = useMemo(() => folders.map((f) => peekImageId(pages, f.id)), [folders, pages]);
  useEffect(() => {
    let live = true;
    for (const id of wanted) {
      if (!id || urls[id]) continue;
      imageUrlFor(id, store.image).then((url) => { if (live && url) setUrls((u) => ({ ...u, [id]: url })); });
    }
    return () => { live = false; };
  }, [wanted, urls, store]);
  return useMemo(() => folders.map((f, i) => {
    const id = wanted[i];
    return { id: f.id, name: f.name, skin: f.skin, pages: pages.filter((p) => p.folderId === f.id).length, peek: id && urls[id] ? { src: urls[id] } : null };
  }), [folders, pages, wanted, urls]);
}
