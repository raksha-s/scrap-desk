// The only code that touches IndexedDB.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder, Page } from '../engine/types';
import { usedImages, visible } from './shared';

export interface StoredImage { id: string; blob: Blob; width: number; height: number }

export interface Repo {
  /** folders and pages in creation order */
  load(): Promise<{ folders: Folder[]; pages: Page[]; seeded: boolean }>;
  markSeeded(): Promise<void>;
  putFolder(f: Folder): Promise<void>;
  /** with its pages and their images */
  deleteFolder(id: string): Promise<void>;
  /** one transaction. A picture the page no longer uses stays until the next tidy-up: another tab may still be showing it */
  putPage(p: Page, extra?: { images?: StoredImage[]; folder?: Folder }): Promise<void>;
  deletePage(id: string): Promise<void>;
  getImage(id: string): Promise<StoredImage | undefined>;
  /** removes the pictures no page uses */
  sweepImages(): Promise<void>;
}

// images are kept as bytes + type: more dependable across browsers than storing Blobs
interface ImageRow { id: string; bytes: ArrayBuffer; mime: string; width: number; height: number }
interface Schema extends DBSchema {
  folders: { key: string; value: Folder };
  pages: { key: string; value: Page };
  images: { key: string; value: ImageRow };
  meta: { key: string; value: boolean };
}
type Db = IDBPDatabase<Schema>;

export async function openRepo(name = 'scrap-desk'): Promise<Repo> {
  let current: Promise<Db> | null = null;
  const forget = (which: Promise<Db>) => { if (current === which) current = null; };

  function connect(): Promise<Db> {
    if (current) return current;
    const mine: Promise<Db> = openDB<Schema>(name, 1, {
      upgrade(d) {
        d.createObjectStore('folders', { keyPath: 'id' });
        d.createObjectStore('pages', { keyPath: 'id' });
        d.createObjectStore('images', { keyPath: 'id' });
        d.createObjectStore('meta');
      },
      terminated() { forget(mine); },
      // a newer version of the app, in another tab, wants to upgrade: get out of its way
      blocking() { forget(mine); void mine.then((d) => d.close()); },
    });
    mine.catch(() => forget(mine));
    return (current = mine);
  }

  // Browsers (iOS Safari especially) drop connections behind our back. One fresh connection and one more try;
  // every job here is safe to run twice.
  async function use<T>(job: (db: Db) => Promise<T>): Promise<T> {
    const first = connect();
    try { return await job(await first); }
    catch (e) {
      if ((e as Error).name === 'QuotaExceededError') throw e;
      forget(first); first.then((d) => d.close()).catch(() => {});
      return job(await connect());
    }
  }

  await connect();                                          // fail now if storage can't be opened at all

  return {
    load: () => use(async (db) => {
      const [folders, pages, seeded] = await Promise.all([db.getAll('folders'), db.getAll('pages'), db.get('meta', 'seeded')]);
      return { ...visible(folders, pages), seeded: seeded === true };
    }),
    markSeeded: () => use(async (db) => { await db.put('meta', true, 'seeded'); }),
    putFolder: (f) => use(async (db) => { await db.put('folders', f); }),
    deleteFolder: (id) => use(async (db) => {
      const tx = db.transaction(['folders', 'pages', 'images'], 'readwrite');
      for (const p of await tx.objectStore('pages').getAll()) {
        if (p.folderId !== id) continue;
        for (const image of usedImages([p])) void tx.objectStore('images').delete(image);
        void tx.objectStore('pages').delete(p.id);
      }
      void tx.objectStore('folders').delete(id);
      await tx.done;
    }),
    async putPage(page, { images = [], folder } = {}) {
      // read the bytes first: a transaction closes itself if anything else is awaited while it is open
      const rows: ImageRow[] = await Promise.all(images.map(async (i) => ({ id: i.id, bytes: await i.blob.arrayBuffer(), mime: i.blob.type, width: i.width, height: i.height })));
      await use(async (db) => {
        const tx = db.transaction(['folders', 'pages', 'images'], 'readwrite');
        for (const row of rows) void tx.objectStore('images').put(row);
        if (folder) void tx.objectStore('folders').put(folder);
        void tx.objectStore('pages').put(page);
        await tx.done;
      });
    },
    deletePage: (id) => use(async (db) => {
      const tx = db.transaction(['pages', 'images'], 'readwrite');
      const page = await tx.objectStore('pages').get(id);
      for (const image of usedImages(page ? [page] : [])) void tx.objectStore('images').delete(image);
      void tx.objectStore('pages').delete(id);
      await tx.done;
    }),
    getImage: (id) => use(async (db) => {
      const row = await db.get('images', id);
      return row && { id: row.id, blob: new Blob([row.bytes], { type: row.mime }), width: row.width, height: row.height };
    }),
    sweepImages: () => use(async (db) => {
      // one transaction, so a page and its new pictures are seen together or not at all
      const tx = db.transaction(['pages', 'images'], 'readwrite');
      const used = usedImages(await tx.objectStore('pages').getAll());
      for (const key of await tx.objectStore('images').getAllKeys()) if (!used.has(key)) void tx.objectStore('images').delete(key);
      await tx.done;
    }),
  };
}
