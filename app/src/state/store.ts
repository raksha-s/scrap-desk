// What the screens read and change. Edits show immediately and are saved behind them, in order.
import { uid } from '../engine/ids';
import { nextSkin } from '../engine/manifest';
import type { Folder, Page } from '../engine/types';
import { memoryRepo } from '../storage/memory';
import type { Repo, StoredImage } from '../storage/repo';
import { byCreation } from '../storage/shared';
import type { Channel } from './channel';

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

/** `channel` links this tab with the others, so that each one builds on what the rest have saved. */
export function createStore(open: () => Promise<Repo>, channel?: Channel) {
  let state: AppState = { ready: false, folders: [], pages: [], saveError: null };
  let repo: Repo = memoryRepo();
  let volatile = false;                                   // storage never opened: the message stays for good
  const listeners = new Set<() => void>();
  const failed = new Set<string>();                       // things whose latest change is not saved
  const unsaved = new Map<string, StoredImage[]>();       // page id → images still waiting to be stored
  const pending = new Map<string, number>();              // things with a write still in the queue
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
    pending.set(key, (pending.get(key) ?? 0) + 1);
    inOrder(job)
      .then(() => { failed.delete(key); channel?.post(); }, () => { failed.add(key); })
      .then(() => {
        const left = pending.get(key)! - 1;
        if (left) pending.set(key, left); else pending.delete(key);
        set({ saveError: errorNow() });
      });
  }

  // another tab saved something: take what is stored, but keep whatever is still unsaved here
  function catchUp() {
    inOrder(async () => {
      const data = await repo.load();
      const merge = <T extends { id: string; createdAt: number }>(kind: 'folder' | 'page', stored: T[], here: T[]): T[] => {
        const mine = (x: T) => pending.has(`${kind}:${x.id}`) || failed.has(`${kind}:${x.id}`);
        return [...stored.filter((x) => !mine(x)), ...here.filter(mine)].sort(byCreation);
      };
      const folders = merge('folder', data.folders, state.folders);
      const ids = new Set(folders.map((f) => f.id));
      const all = merge('page', data.pages, state.pages);
      all.filter((p) => !ids.has(p.folderId)).forEach((p) => { failed.delete(`page:${p.id}`); unsaved.delete(p.id); });
      set({ folders, pages: all.filter((p) => ids.has(p.folderId)), saveError: errorNow() });
    }).catch(() => {});
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
    if (!volatile) {
      inOrder(() => repo.sweepImages()).catch(() => {});    // pictures removed from pages in earlier visits
      channel?.listen(catchUp);
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
      if (!volatile) channel?.post();
      const folders = folder ? [...state.folders.filter((f) => f.id !== folder.id), folder] : state.folders;
      set({ folders, pages: [...state.pages.filter((p) => p.id !== page.id), page] });
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
