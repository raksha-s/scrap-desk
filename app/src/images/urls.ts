import { useEffect, useState } from 'react';
import type { StoredImage } from '../storage/repo';

// one address per stored image for the life of the tab; images never change once stored
const cache = new Map<string, string>();

export function useImageUrl(imageId: string, load: (id: string) => Promise<StoredImage | undefined>): string | undefined {
  const [, setLoaded] = useState(0);
  const url = cache.get(imageId);
  useEffect(() => {
    if (!imageId || cache.has(imageId)) return;
    let live = true;
    load(imageId).then((img) => {
      if (!img) return;
      if (!cache.has(imageId)) cache.set(imageId, URL.createObjectURL(img.blob));
      if (live) setLoaded((n) => n + 1);
    }).catch(() => {});
    return () => { live = false; };
  }, [imageId]);
  return url;
}
