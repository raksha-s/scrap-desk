// What the writing pad has been told so far, and whether that is enough.
import { DEFAULT_FOLDER } from '../../state/store';
import type { StoredImage } from '../../storage/repo';

export const MAX_PHOTOS = 6;
export const STORY_MAX = 900;
export type DraftPhoto = StoredImage & { url: string };

export interface Draft {
  folder: string | 'new' | null; newName: string;
  kind: 'day' | 'range'; start: string; end: string;
  story: string; photos: DraftPhoto[]; touched: boolean;
}
// no folder is chosen unless you came from one
export const emptyDraft = (folderId?: string): Draft => ({ folder: folderId ?? null, newName: DEFAULT_FOLDER, kind: 'day', start: '', end: '', story: '', photos: [], touched: false });

export function dateError(d: Draft): string {
  if (!d.start) return d.touched ? 'Pick a date — every page needs one.' : '';
  if (d.kind === 'range') {
    if (!d.end) return d.touched ? 'Pick the last day of your range.' : '';
    if (d.end < d.start) return 'The range ends before it starts.';
  }
  return '';
}
const dateValid = (d: Draft) => !!d.start && (d.kind !== 'range' || (!!d.end && d.end >= d.start));
const folderValid = (d: Draft) => !!d.folder && (d.folder !== 'new' || !!d.newName.trim());

export function canAdvance(d: Draft, step: 0 | 1 | 2): boolean {
  return step === 0 ? folderValid(d) : step === 1 ? dateValid(d) : true;
}
export const canGenerate = (d: Draft): boolean => folderValid(d) && dateValid(d);

/** Photos fill the six slots in order; `extra` are the ones that didn't fit. */
export function addPhotos(d: Draft, photos: DraftPhoto[]): { draft: Draft; extra: DraftPhoto[] } {
  const room = Math.max(0, MAX_PHOTOS - d.photos.length);
  return { draft: { ...d, photos: [...d.photos, ...photos.slice(0, room)] }, extra: photos.slice(room) };
}
