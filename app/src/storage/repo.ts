// The only code that touches IndexedDB.
import { openDB, type DBSchema } from 'idb';
import type { Folder, Page } from '../engine/types';
import { droppedImages, visible } from './shared';

export interface StoredImage { id: string; blob: Blob; width: number; height: number }

export interface Repo {
  /** folders and pages in creation order */
  load(): Promise<{ folders: Folder[]; pages: Page[]; seeded: boolean }>;
  markSeeded(): Promise<void>;
  putFolder(f: Folder): Promise<void>;
  /** with its pages and their images */
  deleteFolder(id: string): Promise<void>;
  /** one transaction; images the previous version used and this one doesn't are removed */
  putPage(p: Page, extra?: { images?: StoredImage[]; folder?: Folder }): Promise<void>;
  deletePage(id: string): Promise<void>;
  getImage(id: string): Promise<StoredImage | undefined>;
}

// images are kept as bytes + type: more dependable across browsers than storing Blobs
interface ImageRow { id: string; bytes: ArrayBuffer; mime: string; width: number; height: number }
interface Schema extends DBSchema {
  folders: { key: string; value: Folder };
  pages: { key: string; value: Page };
  images: { key: string; value: ImageRow };
  meta: { key: string; value: boolean };
}

export async function openRepo(name = 'scrap-desk'): Promise<Repo> {
  const db = await openDB<Schema>(name, 1, {
    upgrade(d) {
      d.createObjectStore('folders', { keyPath: 'id' });
      d.createObjectStore('pages', { keyPath: 'id' });
      d.createObjectStore('images', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });

  return {
    async load() {
      const [folders, pages, seeded] = await Promise.all([db.getAll('folders'), db.getAll('pages'), db.get('meta', 'seeded')]);
      return { ...visible(folders, pages), seeded: seeded === true };
    },
    async markSeeded() { await db.put('meta', true, 'seeded'); },
    async putFolder(f) { await db.put('folders', f); },
    async deleteFolder(id) {
      const tx = db.transaction(['folders', 'pages', 'images'], 'readwrite');
      for (const p of await tx.objectStore('pages').getAll()) {
        if (p.folderId !== id) continue;
        for (const c of p.cards) void tx.objectStore('images').delete(c.imageId);
        void tx.objectStore('pages').delete(p.id);
      }
      void tx.objectStore('folders').delete(id);
      await tx.done;
    },
    async putPage(page, { images = [], folder } = {}) {
      // read the bytes first: a transaction closes itself if anything else is awaited while it is open
      const rows: ImageRow[] = await Promise.all(images.map(async (i) => ({ id: i.id, bytes: await i.blob.arrayBuffer(), mime: i.blob.type, width: i.width, height: i.height })));
      const tx = db.transaction(['folders', 'pages', 'images'], 'readwrite');
      const imageStore = tx.objectStore('images');
      const before = await tx.objectStore('pages').get(page.id);
      for (const row of rows) void imageStore.put(row);
      for (const gone of droppedImages(before, page)) void imageStore.delete(gone);
      if (folder) void tx.objectStore('folders').put(folder);
      void tx.objectStore('pages').put(page);
      await tx.done;
    },
    async deletePage(id) {
      const tx = db.transaction(['pages', 'images'], 'readwrite');
      const page = await tx.objectStore('pages').get(id);
      for (const c of page?.cards ?? []) void tx.objectStore('images').delete(c.imageId);
      void tx.objectStore('pages').delete(id);
      await tx.done;
    },
    async getImage(id) {
      const row = await db.get('images', id);
      return row && { id: row.id, blob: new Blob([row.bytes], { type: row.mime }), width: row.width, height: row.height };
    },
  };
}
