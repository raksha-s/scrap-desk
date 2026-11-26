// Photos are shrunk as they come in, so journals stay small in browser storage.
import { uid } from '../engine/ids';
import type { StoredImage } from '../storage/repo';

export const MAX_SIDE = 1600;

export function scaledSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export interface Codec {
  decode(b: Blob): Promise<{ width: number; height: number; source: CanvasImageSource }>;
  encode(source: CanvasImageSource, w: number, h: number): Promise<Blob>;
}

export function canvasEncode(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);           // JPEG has no transparency
  x.drawImage(source, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('could not encode the picture'))), 'image/jpeg', 0.85));
}

const browserCodec: Codec = {
  // 'from-image' keeps phone photos the right way up
  decode: async (b) => { const bmp = await createImageBitmap(b, { imageOrientation: 'from-image' }); return { width: bmp.width, height: bmp.height, source: bmp }; },
  encode: canvasEncode,
};

/** Rejects when the browser cannot read the file (HEIC in some browsers, damaged files). */
export async function importImage(file: Blob, codec: Codec = browserCodec): Promise<StoredImage> {
  const { width, height, source } = await codec.decode(file);
  const { w, h } = scaledSize(width, height);
  const blob = await codec.encode(source, w, h);
  (source as { close?: () => void }).close?.();
  return { id: uid('m'), blob, width: w, height: h };
}

export async function importMany(files: File[], codec: Codec = browserCodec): Promise<{ images: StoredImage[]; failed: string[] }> {
  const images: StoredImage[] = []; const failed: string[] = [];
  // one at a time: decoding six large photos at once can exhaust a phone's memory
  for (const f of files) {
    try { images.push(await importImage(f, codec)); } catch { failed.push(f.name); }
  }
  return { images, failed };
}
