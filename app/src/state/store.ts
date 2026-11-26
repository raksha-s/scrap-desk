// What the screens read and change. Edits show immediately and are saved behind them, in order.
import { uid } from '../engine/ids';
import { nextSkin } from '../engine/manifest';
import type { Folder, Page } from '../engine/types';
import { memoryRepo } from '../storage/memory';
import type { Repo, StoredImage } from '../storage/repo';

export const SAVE_ERROR = "Couldn't save. Your browser is blocking storage or has run out of space, so changes may be lost when you close this tab.";
export const DEFAULT_FOLDER = 'Unnamed Folder';
export const NAME_MAX = 28;

export interface AppState { ready: boolean; folders: Folder[]; pages: Page[]; saveError: string | null }

/** A folder that is not saved yet. `usedSkins` are the colours already on the desk. */
export function newFolder(name: string, usedSkins: string[], skin?: string): Folder {
  const clean = name.trim().slice(0, NAME_MAX).trim() || DEFAULT_FOLDER;
  return { id: uid('f'), name: clean, skin: skin ?? nextSkin(usedSkins), createdAt: Date.now() };
}

export type Store = ReturnType<typeof createStore>;

export function createStore(open: () => Promise<Repo>) {
  let state: AppState = { ready: false, folders: [], pages: [], saveError: null };
  let repo: Repo = memoryRepo();
  let volatile = false;                                   // storage never opened: the message stays for good
  const listeners = new Set<() => void>();
  const failed = new Set<string>();                       // things whose latest change is not saved
  const unsaved = new Map<string, StoredImage[]>();       // page id → images still waiting to be stored
  let queue: Promise<unknown> = Promise.resolve();
  let starting: Promise<void> | null = null;

  const set = (patch: Partial<AppState>) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
  const errorNow = () => (volatile || failed.size ? SAVE_ERROR : null);

  // writes run one after another, so the latest change always lands last
  function inOrder<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job);
    queue = run.catch(() => {});
    return run;
  }
  function save(key: string, job: () => Promise<void>) {
    inOrder(job).then(() => { failed.delete(key); }, () => { failed.add(key); }).then(() => set({ saveError: errorNow() }));
  }

  async function start() {
    let data: Awaited<ReturnType<Repo['load']>>;
    try {
      repo = await open();
      data = await repo.load();
    } catch {
      repo = memoryRepo(); volatile = true;
      data = await repo.load();
    }
    set({ ready: true, folders: data.folders, pages: data.pages, saveError: errorNow() });
    if (!data.seeded) {
      if (!data.folders.length) api.addFolder(DEFAULT_FOLDER);
      save('seeded', () => repo.markSeeded());
    }
    // ask the browser not to clear the journals when it tidies up storage
    globalThis.navigator?.storage?.persist?.()?.catch(() => {});
  }

  function changeFolder(id: string, change: Partial<Folder>) {
    const now = state.folders.find((f) => f.id === id); if (!now) return;
    const next = { ...now, ...change };
    set({ folders: state.folders.map((f) => (f.id === id ? next : f)) });
    save(`folder:${id}`, () => repo.putFolder(next));
  }

  const api = {
    get: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    init: () => (starting ??= start()),

    addFolder(name: string, skin?: string): Folder {
      const folder = newFolder(name, state.folders.map((f) => f.skin), skin);
      set({ folders: [...state.folders, folder] });
      save(`folder:${folder.id}`, () => repo.putFolder(folder));
      return folder;
    },
    renameFolder(id: string, name: string) {
      const clean = name.trim().slice(0, NAME_MAX).trim();
      if (clean) changeFolder(id, { name: clean });
    },
    recolorFolder(id: string, skin: string) { changeFolder(id, { skin }); },
    deleteFolder(id: string) {
      const gone = state.pages.filter((p) => p.folderId === id);
      gone.forEach((p) => { unsaved.delete(p.id); failed.delete(`page:${p.id}`); });
      set({ folders: state.folders.filter((f) => f.id !== id), pages: state.pages.filter((p) => p.folderId !== id) });
      save(`folder:${id}`, () => repo.deleteFolder(id));
    },

    /** A new page (and its new folder, if any) appears only once it is saved; rejects otherwise. */
    async addPage(page: Page, images: StoredImage[], folder?: Folder): Promise<void> {
      await inOrder(() => repo.putPage(page, { images, folder }));
      set({ folders: folder ? [...state.folders, folder] : state.folders, pages: [...state.pages, page] });
    },
    updatePage(id: string, change: (p: Page) => Page, images: StoredImage[] = []) {
      const now = state.pages.find((p) => p.id === id); if (!now) return;
      const next = { ...change(now), updatedAt: Date.now() };
      if (images.length) unsaved.set(id, [...(unsaved.get(id) ?? []), ...images]);
      set({ pages: state.pages.map((p) => (p.id === id ? next : p)) });
      save(`page:${id}`, async () => {
        const waiting = unsaved.get(id) ?? [];
        const used = new Set(next.cards.map((c) => c.imageId));
        await repo.putPage(next, { images: waiting.filter((i) => used.has(i.id)) });
        const left = (unsaved.get(id) ?? []).filter((i) => !waiting.includes(i));
        if (left.length) unsaved.set(id, left); else unsaved.delete(id);
      });
    },
    deletePage(id: string) {
      unsaved.delete(id);
      set({ pages: state.pages.filter((p) => p.id !== id) });
      save(`page:${id}`, () => repo.deletePage(id));
    },
    async image(id: string): Promise<StoredImage | undefined> {
      for (const list of unsaved.values()) { const hit = list.find((i) => i.id === id); if (hit) return hit; }
      return repo.getImage(id);
    },
    async flush(): Promise<void> { await queue; await Promise.resolve(); },
  };
  return api;
}
