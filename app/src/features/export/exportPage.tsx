// Draws a clean copy of the page off screen and turns it into a 1800 × 2400 PNG.
import { domToBlob } from 'modern-screenshot';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Page } from '../../engine/types';
import type { StoredImage } from '../../storage/repo';
import { noteFontsReady } from '../page/measureNote';
import { Sheet } from '../page/Sheet';
import { flattenGrain } from './grain';
import { whenImagesLoaded } from './loaded';
import { within } from './within';

export async function exportPage(page: Page, load: (imageId: string) => Promise<StoredImage | undefined>): Promise<Blob> {
  const urls = new Map<string, string>();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;height:1200px;pointer-events:none;';
  let root: ReturnType<typeof createRoot> | null = null;
  try {
    await Promise.all(page.cards.map(async (c) => { const img = await load(c.imageId); if (img) urls.set(c.imageId, URL.createObjectURL(img.blob)); }));
    await flattenGrain(host);
    document.body.append(host);
    root = createRoot(host);
    flushSync(() => root!.render(<Sheet page={page} imageUrl={(id) => urls.get(id)} />));
    await noteFontsReady();
    await document.fonts?.ready;
    await whenImagesLoaded(host);
    const sheet = host.firstElementChild as HTMLElement;
    // a drawing that never finishes must still give the Export key back
    return await within(domToBlob(sheet, { width: 900, height: 1200, scale: 2, type: 'image/png', backgroundColor: '#ffffff', style: { boxShadow: 'none', margin: '0' } }), 60_000);
  } finally {
    const done = root; if (done) setTimeout(() => done.unmount(), 0);
    host.remove();
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
