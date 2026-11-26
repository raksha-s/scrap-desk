import type { Folder, Page } from '../engine/types';

export const byCreation = <T extends { createdAt: number; id: string }>(a: T, b: T): number =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/** Pages whose folder no longer exists (deleted in another tab, say) are left out rather than breaking the desk. */
export function visible(folders: Folder[], pages: Page[]) {
  const ids = new Set(folders.map((f) => f.id));
  return { folders: [...folders].sort(byCreation), pages: pages.filter((p) => ids.has(p.folderId)).sort(byCreation) };
}

export const usedImages = (pages: Page[]): Set<string> => new Set(pages.flatMap((p) => (p.cards ?? []).map((c) => c.imageId)));
