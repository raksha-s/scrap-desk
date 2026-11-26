// The paper grain in the stylesheet is an SVG noise filter; inside an exported image it renders solid black.
// For export it is drawn once to a bitmap, which looks the same.
import { within } from './within';

export interface GrainEnv { read(name: string): string; rasterise(src: string): Promise<string> }

const browser: GrainEnv = {
  read: (name) => getComputedStyle(document.documentElement).getPropertyValue(name),
  rasterise: (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.naturalWidth || 200; c.height = img.naturalHeight || 200;
        c.getContext('2d')!.drawImage(img, 0, 0); res(c.toDataURL('image/png'));
      } catch (e) { rej(e); }                                // some browsers won't let a drawn SVG be read back
    };
    img.onerror = () => rej(new Error('grain'));
    img.src = src;
  }),
};

export async function flattenGrain(host: HTMLElement, env: GrainEnv = browser): Promise<void> {
  for (const name of ['--grain', '--grain-soft']) {
    const src = /url\(\s*(["'])(.*)\1\s*\)/s.exec(env.read(name))?.[2];
    if (!src) continue;
    try { host.style.setProperty(name, `url("${await within(env.rasterise(src.replace(/\\"/g, '"')), 3000)}")`); } catch { /* plain colour is better than no export */ }
  }
}
