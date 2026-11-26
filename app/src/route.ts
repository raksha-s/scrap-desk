// Hash addresses: desk, #/f/<folder>, #/p/<page>.
import { useSyncExternalStore } from 'react';
import type { Folder, Page } from './engine/types';

export type Route = { view: 'home' } | { view: 'folder'; id: string } | { view: 'page'; id: string };

export function parseRoute(hash: string): Route {
  const [, kind, id] = (hash.slice(1) || '/').split('/');
  if (kind === 'f' && id) return { view: 'folder', id };
  if (kind === 'p' && id) return { view: 'page', id };
  return { view: 'home' };
}

export function resolveRoute(r: Route, s: { folders: Folder[]; pages: Page[] }): Route {
  if (r.view === 'folder' && !s.folders.some((f) => f.id === r.id)) return { view: 'home' };
  if (r.view === 'page' && !s.pages.some((p) => p.id === r.id)) return { view: 'home' };
  return r;
}

let entering: string | null = null;                         // a page that should assemble itself when shown

export function go(path: string, opts: { enter?: string } = {}) {
  entering = opts.enter ?? null;
  location.hash = path;
}
export const isEntering = (pageId: string) => entering === pageId;
export const clearEntering = () => { entering = null; };

const subscribe = (fn: () => void) => { addEventListener('hashchange', fn); return () => removeEventListener('hashchange', fn); };
export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
