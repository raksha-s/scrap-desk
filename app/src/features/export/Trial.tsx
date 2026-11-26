// Development only (#/dev/export): a page using every kind of piece, beside its exported image.
import { useEffect, useMemo, useState } from 'react';
import { ruleDirector } from '../../engine/director';
import { layoutPage } from '../../engine/layout';
import { art } from '../../engine/manifest';
import { placeSticker } from '../../engine/place';
import type { ArtType, Card, FrameId, Page, PhotoItem } from '../../engine/types';
import type { StoredImage } from '../../storage/repo';
import { measureNote, noteFontsReady } from '../page/measureNote';
import { Sheet } from '../page/Sheet';
import { exportPage } from './exportPage';

// stand-in photos drawn on a canvas, so the trial needs no real pictures
function picture(id: string, w: number, h: number, hue: number): Promise<StoredImage> {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue} 60% 65%)`); g.addColorStop(1, `hsl(${hue + 60} 45% 35%)`);
  x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = `600 ${h / 6}px sans-serif`; x.fillText(id, 40, h / 2);
  return new Promise((res) => c.toBlob((blob) => res({ id, blob: blob!, width: w, height: h }), 'image/jpeg', 0.85));
}

async function build(): Promise<{ page: Page; images: Map<string, StoredImage> }> {
  const images = new Map<string, StoredImage>(); const cards: Card[] = [];
  for (let i = 0; i < 7; i++) {
    const img = await picture(`photo-${i + 1}`, i % 2 ? 750 : 1000, i % 2 ? 1000 : 750, i * 47);
    images.set(img.id, img);
    cards.push({ id: `c${i}`, kind: i === 6 ? 'album' : 'photo', imageId: img.id, w: img.width, h: img.height, ...(i === 6 ? { album: { title: 'An Album', artist: 'Someone' } } : {}) });
  }
  const story = 'November was quite depressing initially. But just as Diwali started, things started getting better, my friends came over to cook food. I will cherish it all';
  const direction = await ruleDirector.direct({ story, start: '2026-11-01', end: '2026-11-30', cardCount: 6 });
  await noteFontsReady();
  const { items } = layoutPage({ direction, cards, story }, { art, measureNote });
  const frames: FrameId[] = ['polaroid', 'instax', 'film', 'kraft', 'round', 'torn'];
  items.filter((i): i is PhotoItem => i.type === 'photo').forEach((p, i) => { p.frame = frames[i % frames.length]; });
  const page: Page = { id: 'trial', folderId: 'trial', start: '2026-11-01', end: '2026-11-30', story, cards, direction, items, createdAt: 0, updatedAt: 0 };
  const missing = (['stamp', 'leaf', 'pattern', 'sticker', 'flower', 'cat', 'paper'] as ArtType[]).filter((t) => !items.some((i) => i.type === t));
  for (const t of missing) {
    const list = ({ stamp: 'stamps', leaf: 'leaves', pattern: 'patterns', sticker: 'stickers', flower: 'flowers', cat: 'cats', paper: 'papers' } as const)[t];
    page.items = [...page.items, placeSticker(page, t, Object.keys(art[list])[0], art)];
  }
  return { page, images };
}

export function Trial() {
  const [data, setData] = useState<Awaited<ReturnType<typeof build>>>();
  const [out, setOut] = useState<{ url: string; w?: number; h?: number; ms: number; blob: Blob }>();
  const [error, setError] = useState('');
  useEffect(() => { void build().then(setData); }, []);
  const urls = useMemo(() => new Map([...(data?.images ?? [])].map(([id, i]) => [id, URL.createObjectURL(i.blob)])), [data]);
  useEffect(() => {
    if (!data) return;
    const t = performance.now();
    exportPage(data.page, async (id) => data.images.get(id)).then(async (blob) => {
      const bmp = await createImageBitmap(blob);
      const result = { url: URL.createObjectURL(blob), w: bmp.width, h: bmp.height, ms: Math.round(performance.now() - t), blob };
      (window as unknown as { __export: unknown }).__export = result;
      setOut(result);
    }, (e) => setError(String(e)));
  }, [data]);
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', padding: 16, background: '#d4d8d5', font: '14px sans-serif' }}>
      <p id="trialInfo">{error || (out ? `PNG ${out.w} × ${out.h}, ${(out.blob.size / 1024).toFixed(0)} KB, ${out.ms} ms` : 'Exporting…')} — left: on screen, right: exported image</p>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 450, height: 600, flex: 'none' }}><div style={{ transform: 'scale(.5)', transformOrigin: '0 0' }}>{data && <Sheet page={data.page} imageUrl={(id) => urls.get(id)} />}</div></div>
        {out && <img src={out.url} width={450} height={600} alt="Exported page" />}
      </div>
    </div>
  );
}
