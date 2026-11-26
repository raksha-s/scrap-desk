import type { Folder, Page } from '../engine/types';

export const byCreation = <T extends { createdAt: number; id: string }>(a: T, b: T): number =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/** Pages whose folder no longer exists (deleted in another tab, say) are left out rather than breaking the desk. */
export function visible(folders: Folder[], pages: Page[]) {
  const ids = new Set(folders.map((f) => f.id));
  return { folders: [...folders].sort(byCreation), pages: pages.filter((p) => ids.has(p.folderId)).sort(byCreation) };
}

/** Images the earlier version of a page used that the new one doesn't. */
export function droppedImages(before: Page | undefined, after: Page): string[] {
  const kept = new Set(after.cards.map((c) => c.imageId));
  return (before?.cards ?? []).map((c) => c.imageId).filter((id) => !kept.has(id));
}
