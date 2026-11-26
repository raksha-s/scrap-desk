import { describe, expect, it } from 'vitest';
import { image } from '../../test/fixtures';
import { addPhotos, canAdvance, canGenerate, dateError, emptyDraft, type Draft } from './form';

const d: Draft = { ...emptyDraft('f1'), start: '2026-11-05' };
const photo = (id: string) => ({ ...image(id), url: `blob:${id}` });

describe('the writing pad answers', () => {
  it('preselects a folder only when started inside one', () => {
    expect(emptyDraft().folder).toBeNull();
    expect(emptyDraft('f1').folder).toBe('f1');
    expect(emptyDraft().newName).toBe('Unnamed Folder');
    expect(emptyDraft().kind).toBe('day');
  });
  it('explains what is wrong with the dates', () => {
    expect(dateError({ ...d, touched: false, start: '' })).toBe('');
    expect(dateError({ ...d, touched: true, start: '' })).toBe('Pick a date — every page needs one.');
    expect(dateError({ ...d, touched: true, kind: 'range', end: '' })).toBe('Pick the last day of your range.');
    expect(dateError({ ...d, kind: 'range', end: '2026-11-01' })).toBe('The range ends before it starts.');
    expect(dateError(d)).toBe('');
  });
  it('needs a folder, then a date', () => {
    expect(canAdvance(emptyDraft(), 0)).toBe(false);
    expect(canAdvance({ ...d, folder: 'new', newName: '  ' }, 0)).toBe(false);
    expect(canAdvance({ ...d, folder: 'new', newName: 'Trips' }, 0)).toBe(true);
    expect(canAdvance({ ...d, start: '' }, 1)).toBe(false);
    expect(canAdvance({ ...d, kind: 'range', end: '' }, 1)).toBe(false);
    expect(canAdvance({ ...d, kind: 'range', end: '2026-11-05' }, 1)).toBe(true);
    expect(canAdvance(d, 2)).toBe(true);
    expect(canGenerate(d)).toBe(true);
    expect(canGenerate({ ...d, folder: 'new', newName: '  ' })).toBe(false);
    expect(canGenerate({ ...d, start: '' })).toBe(false);
  });
  it('keeps at most six photos and returns the extras', () => {
    const four = addPhotos(d, [1, 2, 3, 4].map((i) => photo(`a${i}`)));
    const full = addPhotos(four.draft, [1, 2, 3].map((i) => photo(`b${i}`)));
    expect(full.draft.photos.map((p) => p.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'b1', 'b2']);
    expect(full.extra.map((p) => p.id)).toEqual(['b3']);
  });
});
