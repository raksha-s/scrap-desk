// Stand-in used when the browser won't give us storage: everything lasts until the tab closes.
import type { Folder, Page } from '../engine/types';
import type { Repo, StoredImage } from './repo';
import { usedImages, visible } from './shared';

export function memoryRepo(): Repo {
  const folders = new Map<string, Folder>(), pages = new Map<string, Page>(), images = new Map<string, StoredImage>();
  let seeded = false;
  const removePage = (id: string) => {
    for (const c of pages.get(id)?.cards ?? []) images.delete(c.imageId);
    pages.delete(id);
  };
  return {
    load: async () => ({ ...visible([...folders.values()], [...pages.values()]), seeded }),
    markSeeded: async () => { seeded = true; },
    putFolder: async (f) => { folders.set(f.id, f); },
    deleteFolder: async (id) => {
      for (const p of [...pages.values()]) if (p.folderId === id) removePage(p.id);
      folders.delete(id);
    },
    putPage: async (page, { images: added = [], folder } = {}) => {
      for (const i of added) images.set(i.id, i);
      if (folder) folders.set(folder.id, folder);
      pages.set(page.id, page);
    },
    deletePage: async (id) => { removePage(id); },
    getImage: async (id) => images.get(id),
    sweepImages: async () => {
      const used = usedImages([...pages.values()]);
      for (const id of [...images.keys()]) if (!used.has(id)) images.delete(id);
    },
  };
}
