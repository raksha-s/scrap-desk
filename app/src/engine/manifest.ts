import data from './manifest.json';
import type { ArtIndex, ArtList, Asset, FolderSkin } from './types';

const LISTS: ArtList[] = ['stamps', 'leaves', 'patterns', 'stickers', 'flowers', 'cats', 'papers'];
const lists = data as unknown as Record<ArtList, Asset[]>;

export const manifestList = (key: ArtList): Asset[] => lists[key];
export const art = Object.fromEntries(LISTS.map((k) => [k, Object.fromEntries(lists[k].map((a) => [a.id, a]))])) as ArtIndex;
export const folderSkins: Record<string, FolderSkin> = Object.fromEntries((data.folders as FolderSkin[]).map((f) => [f.id, f]));

export const SKIN_ORDER = ['f03', 'f09', 'f05', 'f11', 'f04', 'f07', 'f08', 'f12', 'f06', 'f13', 'f10'];
export const SKIN_NAMES: Record<string, string> = { f03: 'Terracotta', f04: 'Sage', f05: 'Forest', f06: 'Burgundy', f07: 'Pink', f08: 'Lavender', f09: 'Cream', f10: 'Charcoal', f11: 'Sky blue', f12: 'Butter', f13: 'Lime' };

/** The colour the next new folder gets: the first one not in use, then round again. */
export function nextSkin(used: string[]): string {
  const taken = new Set(used);
  return SKIN_ORDER.find((s) => !taken.has(s)) ?? SKIN_ORDER[used.length % SKIN_ORDER.length];
}

export const skinColor = (skinId: string): string => folderSkins[skinId]?.avg || '#b86b48';
