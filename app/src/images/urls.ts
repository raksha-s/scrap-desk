import { useEffect, useState } from 'react';
import type { StoredImage } from '../storage/repo';

type Load = (id: string) => Promise<StoredImage | undefined>;
// one address per stored image for the life of the tab; images never change once stored
const cache = new Map<string, string>();

export async function imageUrlFor(imageId: string, load: Load): Promise<string | undefined> {
  if (!cache.has(imageId)) {
    const img = await load(imageId).catch(() => undefined);
    if (img && !cache.has(imageId)) cache.set(imageId, URL.createObjectURL(img.blob));
  }
  return cache.get(imageId);
}

export function useImageUrl(imageId: string, load: Load): string | undefined {
  const [, setLoaded] = useState(0);
  const url = cache.get(imageId);
  useEffect(() => {
    if (!imageId || cache.has(imageId)) return;
    let live = true;
    imageUrlFor(imageId, load).then((found) => { if (live && found) setLoaded((n) => n + 1); });
    return () => { live = false; };
  }, [imageId]);
  return url;
}
