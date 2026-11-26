import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasEncode, importImage, importMany, scaledSize, type Codec } from './import';

const file = (name: string) => new File([name], name, { type: 'image/jpeg' });
const codec: Codec = {
  decode: async (b) => {
    if ((b as File).name?.endsWith('.heic')) throw new Error('cannot decode');
    return { width: 4000, height: 3000, source: {} as CanvasImageSource };
  },
  encode: async (_s, w, h) => new Blob([`${w}x${h}`], { type: 'image/jpeg' }),
};

describe('scaledSize', () => {
  it('shrinks the long side to 1600 and never enlarges', () => {
    expect(scaledSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(scaledSize(900, 3200)).toEqual({ w: 450, h: 1600 });
    expect(scaledSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(scaledSize(10000, 1)).toEqual({ w: 1600, h: 1 });
  });
});

describe('importing', () => {
  it('stores a downscaled copy with its size', async () => {
    const img = await importImage(file('a.jpg'), codec);
    expect(img).toMatchObject({ width: 1600, height: 1200 });
    expect(await img.blob.text()).toBe('1600x1200');
    expect((await importImage(file('a.jpg'), codec)).id).not.toBe(img.id);
  });

  it('names the files it cannot read and keeps the rest, in order', async () => {
    const r = await importMany([file('a.jpg'), file('b.heic'), file('c.jpg')], codec);
    expect(r.images).toHaveLength(2);
    expect(r.failed).toEqual(['b.heic']);
  });
});

describe('encoding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paints white first, so transparency does not turn black', async () => {
    const calls: string[] = [];
    const ctx = {
      set fillStyle(v: string) { calls.push(`fill ${v}`); },
      fillRect: (...a: number[]) => calls.push(`rect ${a.join(',')}`),
      drawImage: () => calls.push('draw'),
    };
    const asked: [string, number][] = [];
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob) => void, type: string, q: number) => { asked.push([type, q]); cb(new Blob(['x'])); } }) });
    await canvasEncode({} as CanvasImageSource, 40, 30);
    expect(calls).toEqual(['fill #fff', 'rect 0,0,40,30', 'draw']);
    expect(asked).toEqual([['image/jpeg', 0.85]]);
  });

  it('fails loudly when the browser returns no picture', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (cb: (b: null) => void) => cb(null) }) });
    await expect(canvasEncode({} as CanvasImageSource, 4, 3)).rejects.toThrow();
  });
});
